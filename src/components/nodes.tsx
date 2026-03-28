import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, SyntheticEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DerivedNodePaint } from "../app/appearance";
import {
  getDecisionInnerSquareSize,
  getNodeInteractionOutset,
  QUICK_CONNECT_BUTTON_OFFSET,
  QUICK_CONNECT_BUTTON_SIZE,
} from "../app/node-geometry";
import { dispatchQuickConnectEvent } from "../app/quick-connect-events";
import type { QuickConnectDirection } from "../app/types";

interface FlowNodeData {
  nodeId: string;
  label: string;
  type: "start" | "terminator" | "process" | "decision" | "custom";
  paint: DerivedNodePaint;
  quickConnectEnabled: boolean;
  connectCandidate?: boolean;
}

interface GroupNodeData {
  groupId: string;
  title: string;
  groupType: "subgraph" | "swimlane";
  collapsed?: boolean;
  childCount: number;
  onResizeEnd?: (groupId: string, width: number, height: number) => void;
  onToggleCollapse?: (groupId: string) => void;
}

type NodeSurfaceStyle = CSSProperties & Record<`--diagram-node-${string}`, string>;

export function FlowNode({ data, selected }: NodeProps) {
  const typed = data as unknown as FlowNodeData;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [interactionHovered, setInteractionHovered] = useState(false);
  const className = `diagram-node-host diagram-node-host--${typed.type}${selected ? " is-selected" : ""}${typed.connectCandidate ? " is-connect-candidate" : ""}`;
  const hostStyle = buildNodeHostStyle(typed, typed.paint, typed.quickConnectEnabled);
  const surfaceStyle = buildNodeSurfaceStyle(typed.type, typed.paint);
  const interactionActive = selected || interactionHovered;
  const updateInteractionFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (selected || !hostRef.current) {
        return;
      }
      const rect = hostRef.current.getBoundingClientRect();
      const interactionOutset = getNodeInteractionOutset();
      const inside =
        clientX >= rect.left - interactionOutset &&
        clientX <= rect.right + interactionOutset &&
        clientY >= rect.top - interactionOutset &&
        clientY <= rect.bottom + interactionOutset;
      setInteractionHovered(inside);
    },
    [selected],
  );

  useEffect(() => {
    if (selected || !interactionHovered) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateInteractionFromPoint(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [interactionHovered, selected, updateInteractionFromPoint]);

  const interactionProps = {
    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) =>
      updateInteractionFromPoint(event.clientX, event.clientY),
    onPointerLeave: () => undefined,
  };

  return (
    <div
      ref={hostRef}
      className={className}
      style={hostStyle}
      data-quick-connect-enabled={typed.quickConnectEnabled ? "true" : "false"}
      data-interaction-active={interactionActive ? "true" : "false"}
    >
      <div
        className="diagram-node__interaction-zone"
        aria-hidden="true"
        {...interactionProps}
        onPointerDown={stopEvent}
        onMouseDown={stopEvent}
        onClick={stopEvent}
      />

      <div className={`diagram-node diagram-node--${typed.type}`} style={surfaceStyle} {...interactionProps}>
        {typed.type === "decision" ? (
          <div className="diagram-node__decision-diamond">
            <div className="diagram-node__label">{typed.label}</div>
          </div>
        ) : (
          <div className="diagram-node__label">{typed.label}</div>
        )}
      </div>

      {typed.quickConnectEnabled ? (
        <>
          <QuickConnectButton nodeId={typed.nodeId} direction="top" {...interactionProps} />
          <QuickConnectButton nodeId={typed.nodeId} direction="right" {...interactionProps} />
          <QuickConnectButton nodeId={typed.nodeId} direction="bottom" {...interactionProps} />
          <QuickConnectButton nodeId={typed.nodeId} direction="left" {...interactionProps} />
        </>
      ) : null}

      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="diagram-handle diagram-handle--left"
        {...interactionProps}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="diagram-handle diagram-handle--right"
        {...interactionProps}
      />
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="diagram-handle diagram-handle--top"
        {...interactionProps}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="diagram-handle diagram-handle--bottom"
        {...interactionProps}
      />
    </div>
  );
}

export function GroupNode({ data, selected }: NodeProps) {
  const typed = data as unknown as GroupNodeData;
  const className = `diagram-group ${typed.groupType === "swimlane" ? "diagram-group--lane" : "diagram-group--subgraph"}${selected ? " is-selected" : ""}`;

  return (
    <div className={className}>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="diagram-group__resizer-line"
        handleClassName="diagram-group__resizer-handle"
        onResizeEnd={(_event, params) => typed.onResizeEnd?.(typed.groupId, params.width, params.height)}
      />
      <div className="diagram-group__header">
        <span>{typed.title}</span>
        <button
          type="button"
          className="diagram-group__toggle"
          aria-label={`${typed.collapsed ? "展开" : "折叠"} ${typed.title}`}
          onPointerDown={stopEvent}
          onMouseDown={stopEvent}
          onClick={(event) => {
            stopEvent(event);
            typed.onToggleCollapse?.(typed.groupId);
          }}
        >
          {typed.collapsed ? "展开" : "折叠"}
        </button>
        <span className="diagram-group__meta">{typed.groupType === "swimlane" ? "泳道" : "subgraph"}</span>
      </div>
      {typed.collapsed ? <div className="diagram-group__collapsed">已折叠，包含 {typed.childCount} 个子项</div> : null}
    </div>
  );
}

function buildNodeHostStyle(
  node: Pick<FlowNodeData, "type">,
  paint: DerivedNodePaint,
  quickConnectEnabled: boolean,
): NodeSurfaceStyle {
  const interactionOutset = getNodeInteractionOutset();
  const decisionInnerSquareSize = node.type === "decision" ? getDecisionInnerSquareSize({ type: node.type }) : 0;
  const isRoundedTerminal = node.type === "start" || node.type === "terminator";
  const borderRadius = isRoundedTerminal ? "999px" : `${paint.borderRadius}px`;
  return {
    "--diagram-node-stroke": paint.stroke,
    "--diagram-node-fill": paint.fill,
    "--diagram-node-text": paint.color,
    "--diagram-node-stroke-width": `${paint.strokeWidth}px`,
    "--diagram-node-stroke-style": paint.strokeDasharray ? "dashed" : "solid",
    "--diagram-node-border-radius": borderRadius,
    "--diagram-node-connector-opacity": quickConnectEnabled ? "1" : "0",
    "--diagram-node-interaction-outset": `${interactionOutset}px`,
    "--diagram-node-quick-connect-size": `${QUICK_CONNECT_BUTTON_SIZE}px`,
    "--diagram-node-quick-connect-offset": `${QUICK_CONNECT_BUTTON_OFFSET}px`,
    "--diagram-node-decision-square-size": `${decisionInnerSquareSize}px`,
  };
}

function buildNodeSurfaceStyle(
  type: FlowNodeData["type"],
  paint: DerivedNodePaint,
): CSSProperties {
  const isRoundedTerminal = type === "start" || type === "terminator";
  const isDecision = type === "decision";
  return {
    backgroundColor: isDecision ? "transparent" : paint.fill,
    borderColor: isDecision ? "transparent" : paint.stroke,
    borderWidth: isDecision ? "0px" : `${paint.strokeWidth}px`,
    borderStyle: paint.strokeDasharray ? "dashed" : "solid",
    color: paint.color,
    borderRadius: isRoundedTerminal ? "999px" : isDecision ? "10px" : `${paint.borderRadius}px`,
  };
}

function QuickConnectButton({
  nodeId,
  direction,
  onPointerEnter,
  onPointerLeave,
}: {
  nodeId: string;
  direction: QuickConnectDirection;
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`diagram-quick-connect diagram-quick-connect--${direction}`}
      aria-label={`快速连接 ${direction}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={stopEvent}
      onMouseDown={stopEvent}
      onClick={(event) => {
        stopEvent(event);
        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
        dispatchQuickConnectEvent({
          nodeId,
          direction,
          anchorClientX: rect.left + rect.width / 2,
          anchorClientY: rect.top + rect.height / 2,
        });
      }}
    >
      <QuickArrowIcon direction={direction} />
    </button>
  );
}

function QuickArrowIcon({ direction }: { direction: QuickConnectDirection }) {
  const rotation =
    direction === "right" ? 0 : direction === "bottom" ? 90 : direction === "left" ? 180 : -90;

  return (
    <svg viewBox="0 0 16 16" className="diagram-quick-connect__icon" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M3 8h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8.5 4.5 12 8l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function stopEvent(event: SyntheticEvent) {
  event.stopPropagation();
}
