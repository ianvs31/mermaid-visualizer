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
});
