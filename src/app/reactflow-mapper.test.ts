import { describe, expect, it } from "vitest";
import { modelToFlowElements } from "./reactflow-mapper";
import type { DiagramModel } from "./types";

function createModel(): DiagramModel {
  return {
    version: 2,
    direction: "LR",
    rawPassthroughStatements: [],
    groups: [],
    nodes: [
      { id: "N1", type: "process", label: "提交申请", x: 80, y: 120, width: 148, height: 72 },
      { id: "N2", type: "decision", label: "审批通过?", x: 320, y: 80, width: 132, height: 132 },
    ],
    edges: [{ id: "E1", from: "N1", to: "N2", label: "", strokePattern: "solid" }],
  };
}

describe("modelToFlowElements", () => {
  it("keeps node metadata focused on render essentials", () => {
    const elements = modelToFlowElements(createModel(), { toolMode: "select" });
    const node = elements.nodes.find((item) => item.id === "N2");

    expect(node?.data).not.toHaveProperty("geometry");
    expect(node?.data).toMatchObject({ quickConnectEnabled: true });
  });

  it("keeps swimlane wrapper hit-through while avoiding visual overrides", () => {
    const model = {
      ...createModel(),
      groups: [
        {
          id: "G1",
          type: "swimlane" as const,
          title: "业务侧",
          childNodeIds: ["N1", "N2"],
          childGroupIds: [],
          x: 40,
          y: 40,
          width: 640,
          height: 280,
        },
      ],
      nodes: createModel().nodes.map((node) => ({ ...node, parentGroupId: "G1" })),
    };
    const elements = modelToFlowElements(model, {});
    const group = elements.nodes.find((item) => item.id === "G1");

    expect(group?.style).toEqual({
      zIndex: 1,
      pointerEvents: "none",
    });
  });

  it("gives edges a wider interaction stroke and selected endpoint hints", () => {
    const elements = modelToFlowElements(createModel(), { selectedEdgeIds: ["E1"] });
    const edge = elements.edges.find((item) => item.id === "E1");

    expect(edge?.type).toBe("flowEdge");
    expect(edge?.interactionWidth).toBeGreaterThanOrEqual(28);
    expect(edge?.data).toMatchObject({
      hiddenByCollapsedGroup: false,
      showEndpointHints: true,
    });
  });
});
