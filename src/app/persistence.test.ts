import { describe, expect, it } from "vitest";
import { loadDraftSnapshot, saveDraftSnapshot } from "./persistence";

describe("draft persistence", () => {
  it("restores a valid versioned draft", () => {
    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
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
      }),
    );

    expect(loadDraftSnapshot()?.code).toContain("flowchart LR");
  });

  it("returns null for malformed payloads", () => {
    localStorage.setItem("mv:draft", "{broken");
    expect(loadDraftSnapshot()).toBeNull();
  });

  it("persists dirty draft state", () => {
    saveDraftSnapshot({
      code: "flowchart LR\nA-->B",
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

    expect(JSON.parse(localStorage.getItem("mv:draft") ?? "{}")).toMatchObject({
      version: 1,
      codeDirty: true,
      code: "flowchart LR\nA-->B",
    });
    expect(loadDraftSnapshot()?.codeDirty).toBe(true);
  });
});
