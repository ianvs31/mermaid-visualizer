import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listStoredDocuments,
  loadStoredDocument,
  loadWorkspaceState,
  migrateLegacyDraftToStoredDocument,
  saveStoredDocument,
  saveWorkspaceState,
} from "./document-persistence";

describe("document persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves named documents and lists recents by last opened time", () => {
    saveStoredDocument({
      version: 1,
      id: "doc-1",
      title: "审批流程",
      createdAt: "2026-03-28T09:00:00.000Z",
      updatedAt: "2026-03-28T09:05:00.000Z",
      lastOpenedAt: "2026-03-28T09:05:00.000Z",
      code: "flowchart LR\nA-->B",
      codeDirty: false,
      model: {
        version: 2,
        direction: "LR",
        nodes: [],
        edges: [],
        groups: [],
        rawPassthroughStatements: [],
      },
    });

    saveStoredDocument({
      version: 1,
      id: "doc-2",
      title: "导入图表",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:10:00.000Z",
      lastOpenedAt: "2026-03-28T10:15:00.000Z",
      code: "flowchart LR\nB-->C",
      codeDirty: true,
      model: {
        version: 2,
        direction: "LR",
        nodes: [],
        edges: [],
        groups: [],
        rawPassthroughStatements: [],
      },
    });

    expect(listStoredDocuments().map((document) => document.id)).toEqual(["doc-2", "doc-1"]);
    expect(loadStoredDocument("doc-2")?.title).toBe("导入图表");
  });

  it("persists workspace state separately from document records", () => {
    saveWorkspaceState({
      version: 1,
      lastOpenedDocumentId: "doc-2",
    });

    expect(loadWorkspaceState()).toEqual({
      version: 1,
      lastOpenedDocumentId: "doc-2",
    });
  });

  it("migrates the legacy draft into a named stored document", () => {
    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-28T10:00:00.000Z",
        code: "flowchart LR\nR1-->R2",
        codeDirty: true,
        model: {
          version: 2,
          direction: "LR",
          nodes: [
            { id: "R1", type: "start", label: "恢复开始", x: 80, y: 120, width: 130, height: 66 },
            { id: "R2", type: "process", label: "恢复处理", x: 280, y: 120, width: 148, height: 72 },
          ],
          edges: [{ id: "RE1", from: "R1", to: "R2", label: "", strokePattern: "solid" }],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    const migrated = migrateLegacyDraftToStoredDocument("未命名图表");

    expect(migrated?.title).toBe("未命名图表");
    expect(migrated?.codeDirty).toBe(true);
    expect(loadWorkspaceState()?.lastOpenedDocumentId).toBe(migrated?.id);
    expect(listStoredDocuments()).toHaveLength(1);
  });
});
