import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties, SyntheticEvent } from "react";
import type { DerivedNodePaint } from "../app/appearance";
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
  title: string;
  groupType: "subgraph" | "swimlane";
  collapsed?: boolean;
  childCount: number;
  onResizeEnd?: (groupId: string, width: number, height: number) => void;
}

export function FlowNode({ data, selected }: NodeProps) {
  const typed = data as unknown as FlowNodeData;
  const className = `diagram-node diagram-node--${typed.type}${selected ? " is-selected" : ""}${typed.connectCandidate ? " is-connect-candidate" : ""}`;
  const style = buildNodeSurfaceStyle(typed.paint, typed.quickConnectEnabled);

  return (
    <div className={className} style={style} data-quick-connect-enabled={typed.quickConnectEnabled ? "true" : "false"}>
      <div className="diagram-node__label">{typed.label}</div>

      {typed.quickConnectEnabled ? (
        <>
          <QuickConnectButton nodeId={typed.nodeId} direction="top" />
          <QuickConnectButton nodeId={typed.nodeId} direction="right" />
          <QuickConnectButton nodeId={typed.nodeId} direction="bottom" />
          <QuickConnectButton nodeId={typed.nodeId} direction="left" />
        </>
      ) : null}

      <Handle id="left" type="target" position={Position.Left} className="diagram-handle diagram-handle--left" />
      <Handle id="right" type="source" position={Position.Right} className="diagram-handle diagram-handle--right" />
      <Handle id="top" type="target" position={Position.Top} className="diagram-handle diagram-handle--top" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="diagram-handle diagram-handle--bottom" />
    </div>
  );
}

export function GroupNode({ id, data, selected }: NodeProps) {
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
        onResizeEnd={(_event, params) => typed.onResizeEnd?.(id, params.width, params.height)}
      />
      <div className="diagram-group__header">
        <span>{typed.title}</span>
        <span className="diagram-group__meta">{typed.groupType === "swimlane" ? "泳道" : "subgraph"}</span>
      </div>
      {typed.collapsed ? <div className="diagram-group__collapsed">已折叠，包含 {typed.childCount} 个子项</div> : null}
    </div>
  );
}

function buildNodeSurfaceStyle(
  paint: DerivedNodePaint,
  quickConnectEnabled: boolean,
): CSSProperties & Record<string, string> {
  return {
    backgroundColor: paint.fill,
    borderColor: paint.stroke,
    borderWidth: `${paint.strokeWidth}px`,
    borderStyle: paint.strokeDasharray ? "dashed" : "solid",
    color: paint.color,
    borderRadius: `${paint.borderRadius}px`,
    "--diagram-node-stroke": paint.stroke,
    "--diagram-node-fill": paint.fill,
    "--diagram-node-text": paint.color,
    "--diagram-node-stroke-width": `${paint.strokeWidth}px`,
    "--diagram-node-stroke-style": paint.strokeDasharray ? "dashed" : "solid",
    "--diagram-node-border-radius": `${paint.borderRadius}px`,
    "--diagram-node-connector-opacity": quickConnectEnabled ? "1" : "0",
  };
}

function QuickConnectButton({
  nodeId,
  direction,
}: {
  nodeId: string;
  direction: QuickConnectDirection;
}) {
  return (
    <button
      type="button"
      className={`diagram-quick-connect diagram-quick-connect--${direction}`}
      aria-label={`快速连接 ${direction}`}
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
