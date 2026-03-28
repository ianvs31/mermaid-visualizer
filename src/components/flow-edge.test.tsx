import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowEdge } from "./FlowEdge";

describe("FlowEdge", () => {
  it("renders endpoint hints when the edge is selected", () => {
    const { container } = render(
      <svg>
        <FlowEdge
          {...({
            id: "E1",
            source: "N1",
            target: "N2",
            sourceX: 40,
            sourceY: 60,
            targetX: 240,
            targetY: 60,
            sourcePosition: "right",
            targetPosition: "left",
            selected: true,
            animated: false,
            selectable: true,
            deletable: true,
            data: { showEndpointHints: true },
            markerEnd: "url(#arrow)",
            interactionWidth: 28,
          } as any)}
        />
      </svg>,
    );

    expect(container.querySelector('[data-testid="flow-edge-endpoint-source"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="flow-edge-endpoint-target"]')).not.toBeNull();
  });
});
