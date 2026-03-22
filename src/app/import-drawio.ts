import { inflateRaw } from "pako";
import { serializeMermaidFlowchartV2 } from "./serializer";
import {
  DEFAULT_DIRECTION,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramModel,
  type DiagramNode,
  type DiagramNodeType,
  type Direction,
  createEmptyModel,
} from "./types";

export type ImportDrawioErrorCode = "INVALID_XML" | "DECOMPRESS_FAILED" | "EMPTY_DIAGRAM";

export class ImportDrawioError extends Error {
  code: ImportDrawioErrorCode;

  constructor(code: ImportDrawioErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ImportDrawioError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface ImportDrawioResult {
  model: DiagramModel;
  mermaid: string;
  warnings: string[];
}

interface RawGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawCell {
  id: string;
  parentId?: string;
  sourceId?: string;
  targetId?: string;
  vertex: boolean;
  edge: boolean;
  style: string;
  styleMap: Record<string, string>;
  value: string;
  geometry: RawGeometry;
}

const TERMINATOR_RE = /(结束|终止|完成|END|STOP|DONE|TERMINATE|FINISH)/i;
const SHAPE_STYLE_KEYS = new Set(["shape", "rounded", "ellipse", "arcsize", "swimlane"]);

export function importDrawioXml(input: string): ImportDrawioResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ImportDrawioError("EMPTY_DIAGRAM", "XML 内容为空，无法导入。");
  }

  const warnings: string[] = [];
  const graphModel = extractGraphModel(trimmed, warnings);
  const model = graphModelToModel(graphModel, warnings);
  const mermaid = serializeMermaidFlowchartV2(model);
  return { model, mermaid, warnings };
}

function extractGraphModel(input: string, warnings: string[]): Element {
  const doc = parseXml(input, "INVALID_XML", "XML 结构无效，无法识别 draw.io 图。");
  const rootTag = normalizeTagName(doc.documentElement.tagName);
  if (rootTag === "mxgraphmodel") {
    return doc.documentElement;
  }

  if (rootTag !== "mxfile") {
    throw new ImportDrawioError("INVALID_XML", "仅支持 draw.io/diagrams.net 的 mxGraphModel 或 mxfile 格式。");
  }

  const diagrams = Array.from(doc.getElementsByTagName("diagram"));
  if (diagrams.length === 0) {
    throw new ImportDrawioError("INVALID_XML", "mxfile 缺少 diagram 节点。");
  }

  if (diagrams.length > 1) {
    warnings.push("检测到多页 diagram，已默认导入第一页。");
  }

  const firstDiagram = diagrams[0];
  const directModel = Array.from(firstDiagram.children).find(
    (child) => normalizeTagName(child.tagName) === "mxgraphmodel",
  );
  if (directModel) {
    return directModel;
  }

  const payload = (firstDiagram.textContent || "").trim();
  if (!payload) {
    throw new ImportDrawioError("EMPTY_DIAGRAM", "diagram 内容为空。");
  }

  if (payload.startsWith("<")) {
    const modelDoc = parseXml(payload, "INVALID_XML", "diagram 中 XML 结构无效。");
    if (normalizeTagName(modelDoc.documentElement.tagName) !== "mxgraphmodel") {
      throw new ImportDrawioError("INVALID_XML", "diagram 中缺少 mxGraphModel 根节点。");
    }
    return modelDoc.documentElement;
  }

  if (payload.startsWith("%")) {
    try {
      const decoded = decodeURIComponent(payload);
      const modelDoc = parseXml(decoded, "INVALID_XML", "diagram 文本解码后 XML 无效。");
      if (normalizeTagName(modelDoc.documentElement.tagName) === "mxgraphmodel") {
        return modelDoc.documentElement;
      }
    } catch {
      // Fall through to compressed decode.
    }
  }

  const decodedXml = decodeCompressedDiagram(payload);
  const modelDoc = parseXml(decodedXml, "DECOMPRESS_FAILED", "压缩 diagram 解码后 XML 无效。");
  if (normalizeTagName(modelDoc.documentElement.tagName) !== "mxgraphmodel") {
    throw new ImportDrawioError("DECOMPRESS_FAILED", "压缩 diagram 解码失败，未得到 mxGraphModel。");
  }
  return modelDoc.documentElement;
}

function decodeCompressedDiagram(payload: string): string {
  try {
    const bytes = decodeBase64(payload);
    const inflated = inflateRaw(bytes, { to: "string" });
    try {
      return decodeURIComponent(inflated);
    } catch {
      return inflated;
    }
  } catch (error) {
    throw new ImportDrawioError("DECOMPRESS_FAILED", "无法解码压缩 diagram 内容。", error);
  }
}

function graphModelToModel(graphModel: Element, warnings: string[]): DiagramModel {
  const root = graphModel.getElementsByTagName("root")[0];
  if (!root) {
    throw new ImportDrawioError("INVALID_XML", "mxGraphModel 缺少 root 节点。");
  }

  const rawCells = collectRawCells(root);
  if (rawCells.length === 0) {
    throw new ImportDrawioError("EMPTY_DIAGRAM", "未解析到任何 mxCell。");
  }

  const groupCells = rawCells.filter((cell) => cell.vertex && cell.styleMap.swimlane !== undefined);
  const groupCellIds = new Set(groupCells.map((cell) => cell.id));
  const nodeCells = rawCells.filter((cell) => cell.vertex && !groupCellIds.has(cell.id));
  const edgeCells = rawCells.filter((cell) => cell.edge);

  const nodeIdMap = createNormalizedIdMap(nodeCells, "N");
  const groupIdMap = createNormalizedIdMap(groupCells, "G");
  const groupCellById = new Map(groupCells.map((cell) => [cell.id, cell]));

  const groups: DiagramGroup[] = groupCells.map((cell, index) => {
    const absolute = resolveAbsolutePosition(cell, groupCellById);
    const parentGroupId = cell.parentId ? groupIdMap.get(cell.parentId) : undefined;
    const orientation = cell.geometry.width >= cell.geometry.height ? "horizontal" : "vertical";
    return {
      id: groupIdMap.get(cell.id)!,
      type: "swimlane",
      title: sanitizeLabel(cell.value) || groupIdMap.get(cell.id)!,
      direction: orientation === "horizontal" ? "LR" : "TB",
      parentGroupId,
      childNodeIds: [],
      childGroupIds: [],
      laneMeta: { orientation, order: index + 1 },
      x: absolute.x,
      y: absolute.y,
      width: positiveOr(cell.geometry.width, 420),
      height: positiveOr(cell.geometry.height, 220),
      collapsed: false,
    };
  });

  const nodes: DiagramNode[] = nodeCells.map((cell) => {
    const absolute = resolveAbsolutePosition(cell, groupCellById);
    const parentGroupId = cell.parentId ? groupIdMap.get(cell.parentId) : undefined;
    const label = sanitizeLabel(cell.value);
    const type = resolveNodeType(cell.styleMap, label);
    return {
      id: nodeIdMap.get(cell.id)!,
      type,
      label: label || nodeIdMap.get(cell.id)!,
      x: absolute.x,
      y: absolute.y,
      width: positiveOr(cell.geometry.width, defaultNodeSize(type).width),
      height: positiveOr(cell.geometry.height, defaultNodeSize(type).height),
      parentGroupId,
    };
  });

  const edges: DiagramEdge[] = [];
  let edgeCounter = 1;
  for (const cell of edgeCells) {
    const sourceId = cell.sourceId ? nodeIdMap.get(cell.sourceId) : undefined;
    const targetId = cell.targetId ? nodeIdMap.get(cell.targetId) : undefined;
    if (!sourceId || !targetId) {
      warnings.push(`已忽略缺失端点的连线：${cell.id}`);
      continue;
    }

    edges.push({
      id: `E${edgeCounter}`,
      from: sourceId,
      to: targetId,
      label: sanitizeLabel(cell.value),
      strokePattern: cell.styleMap.dashed === "1" ? "dashed" : "solid",
    });
    edgeCounter += 1;
  }

  const hasIgnoredStyle = rawCells.some((cell) =>
    Object.keys(cell.styleMap).some((key) => !SHAPE_STYLE_KEYS.has(key)),
  );
  if (hasIgnoredStyle) {
    warnings.push("检测到样式信息，当前仅导入结构、标签与方向。");
  }

  const model = createEmptyModel();
  model.groups = groups;
  model.nodes = nodes;
  model.edges = edges;
  model.direction = inferDirection(nodes, edges);

  for (const group of model.groups) {
    group.childNodeIds = model.nodes.filter((node) => node.parentGroupId === group.id).map((node) => node.id);
    group.childGroupIds = model.groups.filter((item) => item.parentGroupId === group.id).map((item) => item.id);
  }

  if (model.nodes.length === 0 && model.groups.length === 0) {
    throw new ImportDrawioError("EMPTY_DIAGRAM", "XML 中没有可导入的节点或分组。");
  }

  return model;
}

function collectRawCells(root: Element): RawCell[] {
  const result: RawCell[] = [];
  const children = Array.from(root.children);
  for (const child of children) {
    const childTag = normalizeTagName(child.tagName);
    let cellElement: Element | undefined;
    let cellOwner: Element | undefined;

    if (childTag === "mxcell") {
      cellElement = child;
      cellOwner = child;
    } else {
      const candidate = Array.from(child.children).find((item) => normalizeTagName(item.tagName) === "mxcell");
      if (candidate) {
        cellElement = candidate;
        cellOwner = child;
      }
    }

    if (!cellElement || !cellOwner) {
      continue;
    }

    const id = cellElement.getAttribute("id");
    if (!id || id === "0" || id === "1") {
      continue;
    }

    const geometry = parseGeometry(cellElement);
    const style = cellElement.getAttribute("style") || "";
    result.push({
      id,
      parentId: cellElement.getAttribute("parent") || undefined,
      sourceId: cellElement.getAttribute("source") || undefined,
      targetId: cellElement.getAttribute("target") || undefined,
      vertex: cellElement.getAttribute("vertex") === "1",
      edge: cellElement.getAttribute("edge") === "1",
      style,
      styleMap: parseStyleMap(style),
      value:
        cellElement.getAttribute("value") ||
        cellOwner.getAttribute("label") ||
        cellOwner.getAttribute("value") ||
        "",
      geometry,
    });
  }
  return result;
}

function parseGeometry(cellElement: Element): RawGeometry {
  const geometry = Array.from(cellElement.children).find(
    (child) => normalizeTagName(child.tagName) === "mxgeometry",
  );
  if (!geometry) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: Number(geometry.getAttribute("x") || 0),
    y: Number(geometry.getAttribute("y") || 0),
    width: Number(geometry.getAttribute("width") || 0),
    height: Number(geometry.getAttribute("height") || 0),
  };
}

function resolveAbsolutePosition(cell: RawCell, groupCells: Map<string, RawCell>): { x: number; y: number } {
  let x = Number.isFinite(cell.geometry.x) ? cell.geometry.x : 0;
  let y = Number.isFinite(cell.geometry.y) ? cell.geometry.y : 0;
  let parentId = cell.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = groupCells.get(parentId);
    if (!parent) {
      break;
    }
    x += Number.isFinite(parent.geometry.x) ? parent.geometry.x : 0;
    y += Number.isFinite(parent.geometry.y) ? parent.geometry.y : 0;
    parentId = parent.parentId;
  }

  return { x, y };
}

function createNormalizedIdMap(cells: RawCell[], prefix: "N" | "G"): Map<string, string> {
  const map = new Map<string, string>();
  let index = 1;
  for (const cell of cells) {
    map.set(cell.id, `${prefix}${index}`);
    index += 1;
  }
  return map;
}

function resolveNodeType(styleMap: Record<string, string>, label: string): DiagramNodeType {
  const shape = (styleMap.shape || "").toLowerCase();
  if (shape === "rhombus") {
    return "decision";
  }

  const isEllipse = shape === "ellipse" || styleMap.ellipse === "1";
  const isRounded = styleMap.rounded === "1";
  if (isEllipse || isRounded) {
    return TERMINATOR_RE.test(label) ? "terminator" : "start";
  }

  return "process";
}

function defaultNodeSize(type: DiagramNodeType): { width: number; height: number } {
  if (type === "decision") {
    return { width: 132, height: 132 };
  }
  if (type === "start" || type === "terminator") {
    return { width: 130, height: 66 };
  }
  return { width: 148, height: 72 };
}

function inferDirection(nodes: DiagramNode[], edges: DiagramEdge[]): Direction {
  if (edges.length === 0) {
    return DEFAULT_DIRECTION;
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  let horizontal = 0;
  let vertical = 0;

  for (const edge of edges) {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) {
      continue;
    }

    const dx = Math.abs(target.x - source.x);
    const dy = Math.abs(target.y - source.y);
    if (dx === 0 && dy === 0) {
      continue;
    }
    if (dx >= dy) {
      horizontal += dx || 1;
    } else {
      vertical += dy || 1;
    }
  }

  if (horizontal === 0 && vertical === 0) {
    return DEFAULT_DIRECTION;
  }
  return horizontal >= vertical ? "LR" : "TB";
}

function sanitizeLabel(value: string): string {
  if (!value) {
    return "";
  }
  const decoded = decodeXmlEntities(value);
  return decoded
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(value: string): string {
  if (!value) {
    return "";
  }
  if (typeof document === "undefined") {
    return value;
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function parseStyleMap(style: string): Record<string, string> {
  const map: Record<string, string> = {};
  const parts = style
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    map[key] = rest.length ? rest.join("=").trim() : "1";
  }

  return map;
}

function decodeBase64(value: string): Uint8Array {
  const sanitized = value.replace(/\s+/g, "");
  if (typeof atob !== "function") {
    throw new Error("atob is unavailable");
  }
  const binary = atob(sanitized);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseXml(input: string, code: ImportDrawioErrorCode, message: string): XMLDocument {
  const doc = new DOMParser().parseFromString(input, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new ImportDrawioError(code, message);
  }
  return doc;
}

function normalizeTagName(tagName: string): string {
  return tagName.toLowerCase();
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
