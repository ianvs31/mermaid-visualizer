import type { DiagramModel } from "./types";

const STORAGE_KEY = "mv:draft";

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

    return parsed as DraftSnapshotV1;
  } catch {
    return null;
  }
}

function isValidDraftModel(model: unknown): model is DiagramModel {
  if (!isRecord(model) || model.version !== 2 || typeof model.direction !== "string") {
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
    isRecord(node) &&
    typeof node.id === "string" &&
    typeof node.type === "string" &&
    typeof node.label === "string" &&
    typeof node.x === "number" &&
    typeof node.y === "number" &&
    isOptionalNumber(node.width) &&
    isOptionalNumber(node.height) &&
    isOptionalStringArray(node.classNames) &&
    isOptionalRecord(node.style) &&
    isOptionalRecord(node.appearance) &&
    isOptionalString(node.parentGroupId)
  );
}

function isDiagramEdgeLike(edge: unknown): boolean {
  return (
    isRecord(edge) &&
    typeof edge.id === "string" &&
    typeof edge.from === "string" &&
    typeof edge.to === "string" &&
    isOptionalString(edge.label) &&
    isOptionalString(edge.sourceHandle) &&
    isOptionalString(edge.targetHandle) &&
    isOptionalStringArray(edge.classNames) &&
    isOptionalRecord(edge.style)
  );
}

function isDiagramGroupLike(group: unknown): boolean {
  return (
    isRecord(group) &&
    typeof group.id === "string" &&
    typeof group.type === "string" &&
    typeof group.title === "string" &&
    isOptionalString(group.direction) &&
    isOptionalString(group.parentGroupId) &&
    Array.isArray(group.childNodeIds) &&
    group.childNodeIds.every((item) => typeof item === "string") &&
    Array.isArray(group.childGroupIds) &&
    group.childGroupIds.every((item) => typeof item === "string") &&
    typeof group.x === "number" &&
    typeof group.y === "number" &&
    typeof group.width === "number" &&
    typeof group.height === "number" &&
    isOptionalRecord(group.laneMeta) &&
    isOptionalBoolean(group.collapsed)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isOptionalRecord(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isRecord(value);
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
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
