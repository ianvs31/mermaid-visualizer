import { describe, expect, it } from "vitest";
import { pickAutoHandle, validateConnection } from "./connection";
import type { DiagramModel } from "./types";

function baseModel(): DiagramModel {
  return {
    version: 2,
    direction: "LR",
    rawPassthroughStatements: [],
    groups: [],
    nodes: [
      { id: "N1", type: "process", label: "A", x: 0, y: 0, width: 100, height: 60 },
      { id: "N2", type: "process", label: "B", x: 240, y: 0, width: 100, height: 60 },
      { id: "N3", type: "process", label: "C", x: 0, y: 220, width: 100, height: 60, parentGroupId: "G1" },
    ],
    edges: [{ id: "E1", from: "N1", to: "N2", label: "", strokePattern: "solid" }],
  };
}

describe("pickAutoHandle", () => {
  it("prefers horizontal handles when x distance dominates", () => {
    const model = baseModel();
    const pair = pickAutoHandle(model.nodes[0], model.nodes[1]);
    expect(pair).toEqual({ sourceHandle: "right", targetHandle: "left" });
  });

  it("prefers vertical handles when y distance dominates", () => {
    const model = baseModel();
    const pair = pickAutoHandle(model.nodes[0], model.nodes[2]);
    expect(pair).toEqual({ sourceHandle: "bottom", targetHandle: "top" });
  });
});

describe("validateConnection", () => {
  it("rejects duplicate edges", () => {
    const model = baseModel();
    const result = validateConnection({ source: "N1", target: "N2" }, model);
    expect(result.ok).toBe(false);
  });

  it("rejects nodes inside collapsed groups", () => {
    const model = baseModel();
    model.groups = [
      {
        id: "G1",
        type: "subgraph",
        title: "Group",
        childNodeIds: ["N3"],
        childGroupIds: [],
        x: 0,
        y: 180,
        width: 300,
        height: 160,
        collapsed: true,
      },
    ];
    const result = validateConnection({ source: "N1", target: "N3" }, model);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("折叠态");
  });
});
