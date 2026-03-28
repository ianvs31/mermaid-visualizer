import { describe, expect, it } from "vitest";
import { getModelEdgeId, getModelGroupId, getModelNodeId, modelToFlowElements } from "./reactflow-mapper";
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
    const elements = modelToFlowElements(createModel(), { toolMode: "select", flowNamespace: "doc-1" });
    const node = elements.nodes.find((item) => getModelNodeId(item) === "N2");

    expect(node?.data).not.toHaveProperty("geometry");
    expect(node?.data).toMatchObject({ quickConnectEnabled: true });
    expect(node?.id).toBe("doc-1::node::N2");
    expect(node?.domAttributes).toMatchObject({ "data-model-id": "N2" });
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
    const elements = modelToFlowElements(model, { flowNamespace: "doc-1" });
    const group = elements.nodes.find((item) => getModelGroupId(item) === "G1");

    expect(group?.style).toEqual({
      zIndex: 1,
      pointerEvents: "none",
    });
    expect(group?.id).toBe("doc-1::group::G1");
    expect(group?.domAttributes).toMatchObject({ "data-model-id": "G1" });
  });

  it("gives edges a wider interaction stroke and selected endpoint hints", () => {
    const elements = modelToFlowElements(createModel(), { selectedEdgeIds: ["E1"], flowNamespace: "doc-1" });
    const edge = elements.edges.find((item) => getModelEdgeId(item) === "E1");

    expect(edge?.type).toBe("flowEdge");
    expect(edge?.interactionWidth).toBeGreaterThanOrEqual(28);
    expect(edge?.id).toBe("doc-1::edge::E1");
    expect(edge?.source).toBe("doc-1::node::N1");
    expect(edge?.target).toBe("doc-1::node::N2");
    expect(edge?.data).toMatchObject({
      edgeId: "E1",
      hiddenByCollapsedGroup: false,
      showEndpointHints: true,
    });
    expect(edge?.domAttributes).toMatchObject({ "data-model-id": "E1" });
  });
});
