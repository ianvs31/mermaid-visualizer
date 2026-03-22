import type { DiagramModel } from "./types";

const STORAGE_KEY = "mv:draft";
const ALLOWED_DIRECTIONS = new Set(["LR", "RL", "TB", "BT", "TD"]);
const ALLOWED_NODE_TYPES = new Set(["start", "terminator", "process", "decision", "custom"]);
const ALLOWED_EDGE_HANDLES = new Set(["left", "right", "top", "bottom"]);
const ALLOWED_GROUP_TYPES = new Set(["subgraph", "swimlane"]);
const ALLOWED_LANE_ORIENTATIONS = new Set(["horizontal", "vertical"]);
const ALLOWED_FILL_MODES = new Set(["solid", "transparent", "none"]);
const ALLOWED_STROKE_PATTERNS = new Set(["solid", "dashed"]);

export interface DraftSnapshotV1 {
  version: 1;
  savedAt: string;
  code: string;
  codeDirty: boolean;
  model: DiagramModel;
}

export function loadDraftSnapshot(): DraftSnapshotV1 | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DraftSnapshotV1> | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "string" ||
      typeof parsed.code !== "string" ||
      typeof parsed.codeDirty !== "boolean" ||
      !isValidDraftModel(parsed.model)
    ) {
      return null;
    }

    return {
      ...(parsed as DraftSnapshotV1),
      model: normalizeDraftModel(parsed.model),
    };
  } catch {
    return null;
  }
}

function isValidDraftModel(model: unknown): model is DiagramModel {
  if (!isPlainRecord(model) || model.version !== 2 || !isDirection(model.direction)) {
    return false;
  }

  return (
    isDiagramNodeArray(model.nodes) &&
    isDiagramEdgeArray(model.edges) &&
    isDiagramGroupArray(model.groups) &&
    isStringArray(model.rawPassthroughStatements)
  );
}

function isDiagramNodeArray(nodes: unknown): boolean {
  return Array.isArray(nodes) && nodes.every(isDiagramNodeLike);
}

function isDiagramEdgeArray(edges: unknown): boolean {
  return Array.isArray(edges) && edges.every(isDiagramEdgeLike);
}

function isDiagramGroupArray(groups: unknown): boolean {
  return Array.isArray(groups) && groups.every(isDiagramGroupLike);
}

function isDiagramNodeLike(node: unknown): boolean {
  return (
    isPlainRecord(node) &&
    typeof node.id === "string" &&
    isNodeType(node.type) &&
    typeof node.label === "string" &&
    typeof node.x === "number" &&
    typeof node.y === "number" &&
    isOptionalNumber(node.width) &&
    isOptionalNumber(node.height) &&
    isOptionalStringArray(node.classNames) &&
    isOptionalStyle(node.style) &&
    isOptionalAppearance(node.appearance) &&
    isOptionalString(node.parentGroupId)
  );
}

function isDiagramEdgeLike(edge: unknown): boolean {
  return (
    isPlainRecord(edge) &&
    typeof edge.id === "string" &&
    typeof edge.from === "string" &&
    typeof edge.to === "string" &&
    isOptionalString(edge.label) &&
    isOptionalStrokePattern(edge.strokePattern) &&
    isOptionalEdgeHandle(edge.sourceHandle) &&
    isOptionalEdgeHandle(edge.targetHandle) &&
    isOptionalStringArray(edge.classNames) &&
    isOptionalStyle(edge.style)
  );
}

function isDiagramGroupLike(group: unknown): boolean {
  return (
    isPlainRecord(group) &&
    typeof group.id === "string" &&
    isGroupType(group.type) &&
    typeof group.title === "string" &&
    isOptionalDirection(group.direction) &&
    isOptionalString(group.parentGroupId) &&
    Array.isArray(group.childNodeIds) &&
    group.childNodeIds.every((item) => typeof item === "string") &&
    Array.isArray(group.childGroupIds) &&
    group.childGroupIds.every((item) => typeof item === "string") &&
    typeof group.x === "number" &&
    typeof group.y === "number" &&
    typeof group.width === "number" &&
    typeof group.height === "number" &&
    isOptionalLaneMeta(group.laneMeta) &&
    isOptionalBoolean(group.collapsed)
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
}

function isDirection(value: unknown): value is DiagramModel["direction"] {
  return typeof value === "string" && ALLOWED_DIRECTIONS.has(value);
}

function isOptionalDirection(value: unknown): value is DiagramModel["direction"] | undefined {
  return value === undefined || isDirection(value);
}

function isNodeType(value: unknown): value is DiagramModel["nodes"][number]["type"] {
  return typeof value === "string" && ALLOWED_NODE_TYPES.has(value);
}

function isOptionalEdgeHandle(value: unknown): value is DiagramModel["edges"][number]["sourceHandle"] | undefined {
  return value === undefined || (typeof value === "string" && ALLOWED_EDGE_HANDLES.has(value));
}

function isGroupType(value: unknown): value is DiagramModel["groups"][number]["type"] {
  return typeof value === "string" && ALLOWED_GROUP_TYPES.has(value);
}

function isOptionalLaneMeta(value: unknown): value is DiagramModel["groups"][number]["laneMeta"] | undefined {
  if (value === undefined) {
    return true;
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.orientation === "string" &&
    ALLOWED_LANE_ORIENTATIONS.has(value.orientation) &&
    typeof value.order === "number" &&
    Number.isInteger(value.order)
  );
}

function isOptionalStyle(value: unknown): value is Record<string, string> | undefined {
  if (value === undefined) {
    return true;
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}

function isOptionalAppearance(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isFillMode(value.fillMode) &&
    typeof value.fillColor === "string" &&
    typeof value.strokeColor === "string" &&
    isStrokePattern(value.strokePattern) &&
    typeof value.strokeWidth === "number" &&
    Number.isFinite(value.strokeWidth) &&
    typeof value.cornerRadius === "number" &&
    Number.isFinite(value.cornerRadius)
  );
}

function isFillMode(value: unknown): value is "solid" | "transparent" | "none" {
  return typeof value === "string" && ALLOWED_FILL_MODES.has(value);
}

function isStrokePattern(value: unknown): value is "solid" | "dashed" {
  return typeof value === "string" && ALLOWED_STROKE_PATTERNS.has(value);
}

function isOptionalStrokePattern(value: unknown): value is "solid" | "dashed" | undefined {
  return value === undefined || isStrokePattern(value);
}

function normalizeDraftModel(model: DraftSnapshotV1["model"]): DraftSnapshotV1["model"] {
  return {
    ...model,
    edges: model.edges.map((edge) => ({
      ...edge,
      strokePattern: edge.strokePattern ?? "solid",
    })),
  };
}

export function saveDraftSnapshot(snapshot: { code: string; codeDirty: boolean; model: DiagramModel }): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const draft: DraftSnapshotV1 = {
      version: 1,
      savedAt: new Date().toISOString(),
      code: snapshot.code,
      codeDirty: snapshot.codeDirty,
      model: snapshot.model,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}
