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

  it("returns null for parseable snapshots without a complete model", () => {
    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
        code: "flowchart LR\nA-->B",
        codeDirty: false,
        model: { version: 2 },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with malformed node payloads", () => {
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
          nodes: [{ id: "N1", type: "process", label: "节点", x: 80, y: 120, width: "wide" }],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with invalid node style payloads", () => {
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
          nodes: [{ id: "N1", type: "process", label: "节点", x: 80, y: 120, style: { fill: "#fff", width: 2 } }],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with array-based style payloads", () => {
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
          nodes: [{ id: "N1", type: "process", label: "节点", x: 80, y: 120, style: ["fill:#fff"] }],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with invalid node types", () => {
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
          nodes: [{ id: "N1", type: "mystery", label: "节点", x: 80, y: 120 }],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with malformed appearance payloads", () => {
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
          nodes: [
            {
              id: "N1",
              type: "process",
              label: "节点",
              x: 80,
              y: 120,
              appearance: { fillMode: "solid", fillColor: "#fff" },
            },
          ],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with array-based appearance payloads", () => {
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
          nodes: [{ id: "N1", type: "process", label: "节点", x: 80, y: 120, appearance: [] }],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with malformed edge payloads", () => {
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
          edges: [{ id: "E1", from: "N1", to: 42 }],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with invalid edge handles", () => {
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
          edges: [{ id: "E1", from: "N1", to: "N2", sourceHandle: "diagonal" }],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with malformed group payloads", () => {
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
          groups: [{ id: "G1", type: "swimlane", title: "分区", x: "oops", y: 40, width: 120, height: 80 }],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()).toBeNull();
  });

  it("returns null for snapshots with invalid group enums and laneMeta", () => {
    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
        code: "flowchart LR\nA-->B",
        codeDirty: false,
        model: {
          version: 2,
          direction: "sideways",
          nodes: [],
          edges: [],
          groups: [
            {
              id: "G1",
              type: "lane",
              title: "分区",
              direction: "diagonal",
              childNodeIds: [],
              childGroupIds: [],
              laneMeta: { orientation: "spiral", order: "first" },
              x: 40,
              y: 40,
              width: 120,
              height: 80,
            },
          ],
          rawPassthroughStatements: [],
        },
      }),
    );

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
