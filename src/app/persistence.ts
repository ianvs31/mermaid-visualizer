import type { DiagramModel } from "./types";

const STORAGE_KEY = "mv:draft";

export interface DraftSnapshotV1 {
  version: 1;
  savedAt: string;
  code: string;
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
      !parsed.model ||
      parsed.model.version !== 2
    ) {
      return null;
    }

    return parsed as DraftSnapshotV1;
  } catch {
    return null;
  }
}

export function saveDraftSnapshot(snapshot: { code: string; model: DiagramModel }): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const draft: DraftSnapshotV1 = {
      version: 1,
      savedAt: new Date().toISOString(),
      code: snapshot.code,
      model: snapshot.model,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}
