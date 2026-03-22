import {
  DEFAULT_DIRECTION,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramModel,
  type DiagramNode,
  type DiagramNodeType,
  type Direction,
  type ParseResult,
  createEmptyModel,
} from "./types";
import { inferAppearanceFromStyle, stripPaintStyle } from "./appearance";

interface EndpointToken {
  id: string;
  shape?: "circle" | "stadium" | "round" | "rect" | "decision";
  label?: string;
}

const HEADER_RE = /^(flowchart|graph)\s+(LR|RL|TB|BT|TD)\s*$/i;
const DIRECTION_RE = /^direction\s+(LR|RL|TB|BT|TD)\s*$/i;
const SUBGRAPH_RE = /^subgraph\s+(.+)$/i;
const CLASS_RE = /^class\s+(.+?)\s+([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*)\s*$/i;
const STYLE_RE = /^style\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+)$/i;

export function parseMermaidFlowchartV2(input: string): ParseResult {
  const model = createEmptyModel();
  const warnings: string[] = [];
  const errors: string[] = [];

  const lines = input.split(/\r?\n/);
  const nodeMap = new Map<string, DiagramNode>();
  const groupMap = new Map<string, DiagramGroup>();
  const edgeMap = new Map<string, DiagramEdge>();
  const groupStack: string[] = [];
  const laneMeta = new Map<string, { orientation: "horizontal" | "vertical"; order: number }>();
  const appearanceMeta = new Map<string, string>();
  const emptyLabelMeta = new Set<string>();
  let autoGroupIndex = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      continue;
    }

    const laneMetaMatch = line.match(/^%%\s*editor:lane\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(horizontal|vertical)\s+(\d+)\s*$/i);
    if (laneMetaMatch) {
      laneMeta.set(laneMetaMatch[1], {
        orientation: laneMetaMatch[2].toLowerCase() as "horizontal" | "vertical",
        order: Number(laneMetaMatch[3]),
      });
      continue;
    }

    const appearanceMetaMatch = line.match(/^%%\s*editor:appearance\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+)$/i);
    if (appearanceMetaMatch) {
      appearanceMeta.set(appearanceMetaMatch[1], appearanceMetaMatch[2]);
      continue;
    }

    const emptyLabelMatch = line.match(/^%%\s*editor:empty-label\s+([A-Za-z_][A-Za-z0-9_-]*)\s*$/i);
    if (emptyLabelMatch) {
      emptyLabelMeta.add(emptyLabelMatch[1]);
      continue;
    }

    if (line.startsWith("%%")) {
      model.rawPassthroughStatements.push(line);
      continue;
    }

    const lineWithoutComment = stripInlineComment(raw).trim();
    if (!lineWithoutComment) {
      continue;
    }

    const headerMatch = lineWithoutComment.match(HEADER_RE);
    if (headerMatch) {
      model.direction = normalizeDirection(headerMatch[2]);
      continue;
    }

    const directionMatch = lineWithoutComment.match(DIRECTION_RE);
    if (directionMatch) {
      const currentGroup = groupStack.at(-1);
      if (currentGroup) {
        const group = groupMap.get(currentGroup);
        if (group) {
          group.direction = normalizeDirection(directionMatch[1]);
        }
      } else {
        model.direction = normalizeDirection(directionMatch[1]);
      }
      continue;
    }

    const subgraphMatch = lineWithoutComment.match(SUBGRAPH_RE);
    if (subgraphMatch) {
      const parsed = parseSubgraphDescriptor(subgraphMatch[1]);
      const groupId = parsed.id || `G${autoGroupIndex++}`;
      const parentGroupId = groupStack.at(-1);

      const group: DiagramGroup = {
        id: groupId,
        type: laneMeta.has(groupId) ? "swimlane" : "subgraph",
        title: parsed.title || parsed.id || groupId,
        direction: undefined,
        parentGroupId,
        childNodeIds: [],
        childGroupIds: [],
        laneMeta: laneMeta.get(groupId),
        x: 0,
        y: 0,
        width: 420,
        height: 220,
      };

      groupMap.set(groupId, group);
      groupStack.push(groupId);
      continue;
    }

    if (/^end\s*$/i.test(lineWithoutComment)) {
      if (groupStack.length === 0) {
        warnings.push(`第 ${i + 1} 行存在孤立 end，已忽略。`);
      } else {
        groupStack.pop();
      }
      continue;
    }

    const classDefLike = /^(classDef|linkStyle|click)\b/i.test(lineWithoutComment);
    if (classDefLike) {
      model.rawPassthroughStatements.push(lineWithoutComment);
      continue;
    }

    const classMatch = lineWithoutComment.match(CLASS_RE);
    if (classMatch) {
      const nodeIds = classMatch[1]
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const classNames = classMatch[2]
        .split(/\s+/)
        .map((c) => c.trim())
        .filter(Boolean);
      for (const nodeId of nodeIds) {
        const node = getOrCreateNode(nodeMap, nodeId, groupStack.at(-1));
        node.classNames = unique([...toArray(node.classNames), ...classNames]);
      }
      continue;
    }

    const styleMatch = lineWithoutComment.match(STYLE_RE);
    if (styleMatch) {
      const nodeId = styleMatch[1];
      const style = parseStyleBlock(styleMatch[2]);
      if (!Object.keys(style).length) {
        model.rawPassthroughStatements.push(lineWithoutComment);
      } else {
        const node = getOrCreateNode(nodeMap, nodeId, groupStack.at(-1));
        node.style = { ...(node.style || {}), ...style };
      }
      continue;
    }

    if (looksLikeEdgeStatement(lineWithoutComment)) {
      const parsedEdge = parseEdgeStatement(lineWithoutComment);
      if (!parsedEdge) {
        warnings.push(`第 ${i + 1} 行连线语法未完全支持，已保留原语句。`);
        model.rawPassthroughStatements.push(lineWithoutComment);
        continue;
      }

      const from = ensureNodeFromToken(nodeMap, parsedEdge.from, groupStack.at(-1));
      const to = ensureNodeFromToken(nodeMap, parsedEdge.to, groupStack.at(-1));
      const edgeId = `E${edgeMap.size + 1}`;

      edgeMap.set(edgeId, {
        id: edgeId,
        from: from.id,
        to: to.id,
        label: parsedEdge.label || "",
        strokePattern: parsedEdge.strokePattern,
      });
      continue;
    }

    const nodeToken = parseEndpointToken(lineWithoutComment);
    if (nodeToken) {
      ensureNodeFromToken(nodeMap, nodeToken, groupStack.at(-1));
      continue;
    }

    model.rawPassthroughStatements.push(lineWithoutComment);
  }

  if (groupStack.length > 0) {
    warnings.push(`存在 ${groupStack.length} 个 subgraph 未闭合，已自动闭合。`);
  }

  model.nodes = Array.from(nodeMap.values());
  model.edges = Array.from(edgeMap.values());
  model.groups = Array.from(groupMap.values());

  for (const node of model.nodes) {
    const appearanceBlock = appearanceMeta.get(node.id);
    if (appearanceBlock) {
      node.appearance = parseAppearanceBlock(appearanceBlock);
    } else {
      node.appearance = inferAppearanceFromStyle(node.style);
    }

    if (emptyLabelMeta.has(node.id)) {
      node.label = "";
    }

    if (node.appearance) {
      node.style = stripPaintStyle(node.style);
    }
  }

  if (model.nodes.length === 0 && model.groups.length === 0) {
    errors.push("未解析到可编辑元素，请检查 Mermaid 语法是否属于 flowchart。");
  }

  for (const group of model.groups) {
    group.childNodeIds = model.nodes.filter((node) => node.parentGroupId === group.id).map((node) => node.id);
    group.childGroupIds = model.groups.filter((g) => g.parentGroupId === group.id).map((g) => g.id);
    if (laneMeta.has(group.id)) {
      group.type = "swimlane";
      group.laneMeta = laneMeta.get(group.id);
    }
  }

  applyFallbackPositions(model);

  return {
    model,
    warnings,
    errors,
  };
}

function applyFallbackPositions(model: DiagramModel): void {
  const topLevelNodes = model.nodes.filter((node) => !node.parentGroupId);
  const spacingX = isVertical(model.direction) ? 220 : 240;
  const spacingY = isVertical(model.direction) ? 160 : 140;

  topLevelNodes.forEach((node, index) => {
    if (node.x !== 0 || node.y !== 0) {
      return;
    }
    const row = Math.floor(index / 4);
    const col = index % 4;
    node.x = 60 + col * spacingX;
    node.y = 60 + row * spacingY;
  });

  for (const group of model.groups) {
    const index = model.groups.findIndex((g) => g.id === group.id);
    if (group.x === 0 && group.y === 0) {
      group.x = 40 + (index % 3) * 460;
      group.y = 40 + Math.floor(index / 3) * 280;
    }
  }

  for (const node of model.nodes) {
    if (!node.parentGroupId) {
      continue;
    }
    const parent = model.groups.find((group) => group.id === node.parentGroupId);
    if (!parent) {
      continue;
    }
    if (node.x === 0 && node.y === 0) {
      const offset = parent.childNodeIds.indexOf(node.id);
      node.x = parent.x + 40 + (offset % 3) * 160;
      node.y = parent.y + 60 + Math.floor(offset / 3) * 100;
    }
  }
}

function parseSubgraphDescriptor(content: string): { id?: string; title?: string } {
  const text = content.trim();

  const bracketMatch = text.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*\[(.*)\]$/);
  if (bracketMatch) {
    return {
      id: bracketMatch[1],
      title: stripWrapping(bracketMatch[2]),
    };
  }

  const quotedMatch = text.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+(["'].*["'])$/);
  if (quotedMatch) {
    return {
      id: quotedMatch[1],
      title: stripWrapping(quotedMatch[2]),
    };
  }

  if (/^["'].*["']$/.test(text)) {
    return { title: stripWrapping(text) };
  }

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return {
      id: parts[0],
      title: parts.slice(1).join(" "),
    };
  }

  return {
    id: text,
    title: text,
  };
}

function parseEdgeStatement(
  line: string,
): { from: EndpointToken; to: EndpointToken; label?: string; strokePattern: "solid" | "dashed" } | null {
  if (countSupportedEdgeOperators(line) > 1) {
    return null;
  }

  const patterns = [
    { regex: /^(.*?)\s*-\.\s*(.+?)\s*\.->\s*(.*?)$/, strokePattern: "dashed" as const, labelIndex: 2 },
    { regex: /^(.*?)\s*-\.->\s*\|([^|]+)\|\s*(.*?)$/, strokePattern: "dashed" as const, labelIndex: 2 },
    { regex: /^(.*?)\s*-\.->\s*(.*?)$/, strokePattern: "dashed" as const, labelIndex: undefined },
    { regex: /^(.*?)\s*-->\s*\|([^|]+)\|\s*(.*?)$/, strokePattern: "solid" as const, labelIndex: 2 },
    { regex: /^(.*?)\s*--\s*(.+?)\s*-->\s*(.*?)$/, strokePattern: "solid" as const, labelIndex: 2 },
    { regex: /^(.*?)\s*-->\s*(.*?)$/, strokePattern: "solid" as const, labelIndex: undefined },
  ];

  for (const pattern of patterns) {
    const matched = line.match(pattern.regex);
    if (!matched) {
      continue;
    }

    const fromToken = parseEndpointToken(matched[1].trim());
    const toToken = parseEndpointToken(matched[3]?.trim?.() ?? matched[2].trim());
    if (!fromToken || !toToken) {
      return null;
    }

    const label = pattern.labelIndex === undefined ? undefined : matched[pattern.labelIndex]?.trim();
    return {
      from: fromToken,
      to: toToken,
      label,
      strokePattern: pattern.strokePattern,
    };
  }

  return null;
}

function parseEndpointToken(token: string): EndpointToken | null {
  const idMatch = token.match(/^([A-Za-z_][A-Za-z0-9_-]*)(.*)$/);
  if (!idMatch) {
    return null;
  }

  const id = idMatch[1];
  const suffix = idMatch[2].trim();
  if (!suffix) {
    return { id };
  }

  const shapePatterns = [
    { regex: /^\(\((.*)\)\)$/, shape: "circle" as const },
    { regex: /^\(\[(.*)\]\)$/, shape: "stadium" as const },
    { regex: /^\((.*)\)$/, shape: "round" as const },
    { regex: /^\[(.*)\]$/, shape: "rect" as const },
    { regex: /^\{(.*)\}$/, shape: "decision" as const },
  ];

  for (const pattern of shapePatterns) {
    const matched = suffix.match(pattern.regex);
    if (!matched) {
      continue;
    }

    return {
      id,
      shape: pattern.shape,
      label: stripWrapping(matched[1].trim()),
    };
  }

  return null;
}

function ensureNodeFromToken(
  nodeMap: Map<string, DiagramNode>,
  token: EndpointToken,
  parentGroupId: string | undefined,
): DiagramNode {
  const node = getOrCreateNode(nodeMap, token.id, parentGroupId);
  if (token.label !== undefined) {
    node.label = token.label;
  }
  if (token.shape) {
    node.type = mapShape(token.shape, node.label);
  }
  if (!node.parentGroupId && parentGroupId) {
    node.parentGroupId = parentGroupId;
  }
  return node;
}

function getOrCreateNode(
  nodeMap: Map<string, DiagramNode>,
  id: string,
  parentGroupId: string | undefined,
): DiagramNode {
  const existing = nodeMap.get(id);
  if (existing) {
    return existing;
  }

  const next: DiagramNode = {
    id,
    type: "process",
    label: id,
    x: 0,
    y: 0,
    width: 140,
    height: 64,
    parentGroupId,
  };

  nodeMap.set(id, next);
  return next;
}

function mapShape(shape: "circle" | "stadium" | "round" | "rect" | "decision", label: string): DiagramNodeType {
  if (shape === "decision") {
    return "decision";
  }
  if (shape === "circle") {
    return "start";
  }
  if (shape === "stadium") {
    return "terminator";
  }
  if (shape === "round") {
    if (/(结束|终止|完成|END|STOP|DONE)/i.test(label)) {
      return "terminator";
    }
    return "start";
  }
  return "process";
}

function parseStyleBlock(content: string): Record<string, string> {
  const style: Record<string, string> = {};
  const parts = content
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [key, ...valueParts] = part.split(":");
    if (!key || valueParts.length === 0) {
      continue;
    }
    style[key.trim()] = valueParts.join(":").trim();
  }

  return style;
}

function stripInlineComment(line: string): string {
  const index = line.indexOf("%%");
  return index >= 0 ? line.slice(0, index) : line;
}

function stripWrapping(text: string): string {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeDirection(input: string): Direction {
  const value = input.toUpperCase() as Direction;
  return ["LR", "RL", "TB", "BT", "TD"].includes(value) ? value : DEFAULT_DIRECTION;
}

function parseAppearanceBlock(content: string) {
  const pairs = content
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => entry.split("="))
    .filter((entry) => entry.length === 2);

  const map = Object.fromEntries(pairs) as Record<string, string>;
  const fillMode =
    map.fillMode === "transparent" || map.fillMode === "none"
      ? map.fillMode
      : map.fill === "transparent" || map.fill === "none"
        ? map.fill
        : "solid";

  return {
    fillMode,
    fillColor: map.fillColor || map.base || "#ffffff",
    strokeColor: map.strokeColor || map.base || "#344054",
    strokePattern:
      map.strokePattern === "dashed" || map.stroke === "dashed"
        ? "dashed"
        : "solid",
    strokeWidth: Number(map.width) || 2,
    cornerRadius: Number(map.radius) || 10,
  } as const;
}

function isVertical(direction: Direction): boolean {
  return direction === "TB" || direction === "TD" || direction === "BT";
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function toArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function looksLikeEdgeStatement(line: string): boolean {
  return /-->|-\.->|-\.\s+.+\s+\.->|---|==>/.test(line);
}

function countSupportedEdgeOperators(line: string): number {
  return (line.match(/-\.->|-\.\s+.+?\s+\.->|-->/g) || []).length;
}
