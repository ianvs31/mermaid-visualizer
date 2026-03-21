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
    typeof node.y === "number"
  );
}

function isDiagramEdgeLike(edge: unknown): boolean {
  return (
    isRecord(edge) &&
    typeof edge.id === "string" &&
    typeof edge.from === "string" &&
    typeof edge.to === "string"
  );
}

function isDiagramGroupLike(group: unknown): boolean {
  return (
    isRecord(group) &&
    typeof group.id === "string" &&
    typeof group.type === "string" &&
    typeof group.title === "string" &&
    Array.isArray(group.childNodeIds) &&
    Array.isArray(group.childGroupIds)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
