import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowNode } from "./nodes";

afterEach(() => {
  cleanup();
});

describe("FlowNode", () => {
  it("applies paint to the visible node surface", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "开始",
              type: "process",
              quickConnectEnabled: true,
              paint: {
                fill: "rgba(95, 161, 239, 0.18)",
                stroke: "#7b57ea",
                color: "#1f2937",
                strokeWidth: 2,
                strokeDasharray: "6 4",
                borderRadius: 10,
              },
            },
            selected: true,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const nodeSurface = screen.getByText("开始").closest(".diagram-node") as HTMLElement;
    expect(nodeSurface).not.toBeNull();
    expect(nodeSurface.style.backgroundColor).toBe("rgba(95, 161, 239, 0.18)");
    expect(nodeSurface.style.borderColor).toBe("rgb(123, 87, 234)");
    expect(nodeSurface.style.borderStyle).toBe("dashed");
    expect(nodeSurface.style.color).toBe("rgb(31, 41, 55)");
  });

  it("renders quick connect buttons only when enabled", () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "开始",
              type: "process",
              quickConnectEnabled: true,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(4);

    rerender(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "开始",
              type: "process",
              quickConnectEnabled: false,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders start nodes as stadiums instead of circles", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "开始",
              type: "start",
              quickConnectEnabled: false,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const nodeSurface = screen.getByText("开始").closest(".diagram-node") as HTMLElement;
    expect(nodeSurface).not.toBeNull();
    expect(nodeSurface.style.borderRadius).toBe("999px");
    expect(nodeSurface.style.aspectRatio).toBe("");
  });

  it("renders terminator nodes as stadiums instead of generic rounded rectangles", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "结束",
              type: "terminator",
              quickConnectEnabled: false,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const nodeSurface = screen.getByText("结束").closest(".diagram-node") as HTMLElement;
    expect(nodeSurface).not.toBeNull();
    expect(nodeSurface.style.borderRadius).toBe("999px");
    expect(nodeSurface.style.aspectRatio).toBe("");
  });

  it("does not render an extra hover shell around quick connect affordances", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N1",
            data: {
              nodeId: "N1",
              label: "处理步骤",
              type: "process",
              geometry: "rect",
              quickConnectEnabled: true,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    expect(document.querySelector(".diagram-node__hover-shell")).toBeNull();
  });

  it("renders an expanded interaction zone sized from the quick-connect extrema", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N8",
            data: {
              nodeId: "N8",
              label: "处理步骤",
              type: "process",
              quickConnectEnabled: true,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const host = screen.getByText("处理步骤").closest(".diagram-node-host") as HTMLElement;
    const surface = screen.getByText("处理步骤").closest(".diagram-node") as HTMLElement;
    const interactionZone = host.querySelector(".diagram-node__interaction-zone") as HTMLElement;

    expect(host.dataset.interactionActive).toBe("false");
    expect(surface).not.toBeNull();
    expect(interactionZone).not.toBeNull();
    expect(host.style.getPropertyValue("--diagram-node-interaction-outset")).toBe("54px");
  });

  it("keeps decision nodes free of extra geometry metadata on the shared node root", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N3",
            data: {
              nodeId: "N3",
              label: "审批通过?",
              type: "decision",
              geometry: "diamond",
              quickConnectEnabled: true,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const nodeSurface = screen.getByText("审批通过?").closest(".diagram-node") as HTMLElement;
    expect(nodeSurface.dataset.geometry).toBeUndefined();
  });

  it("renders decision nodes with an inner diamond surface instead of clipping the shared host", () => {
    render(
      <ReactFlowProvider>
        <FlowNode
          {...({
            id: "N9",
            data: {
              nodeId: "N9",
              label: "审批通过?",
              type: "decision",
              quickConnectEnabled: true,
              paint: {
                fill: "#ffffff",
                stroke: "#344054",
                color: "#111827",
                strokeWidth: 2,
                borderRadius: 10,
              },
            },
            selected: false,
            dragging: false,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    const host = screen.getByText("审批通过?").closest(".diagram-node-host") as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.className).toContain("diagram-node-host--decision");
    expect(host.querySelector(".diagram-node__decision-diamond")).not.toBeNull();
  });
});
