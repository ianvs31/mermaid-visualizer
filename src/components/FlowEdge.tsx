import { BaseEdge, getSmoothStepPath, type EdgeProps, type Position } from "@xyflow/react";

interface FlowEdgeData {
  showEndpointHints?: boolean;
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = "right" as Position,
  targetPosition = "left" as Position,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  selected,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const typedData = (data ?? {}) as FlowEdgeData;
  const showEndpointHints = selected && typedData.showEndpointHints;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {showEndpointHints ? (
        <g className="flow-edge__endpoints" aria-hidden="true">
          <circle className="flow-edge__endpoint" cx={sourceX} cy={sourceY} r="4.5" data-testid="flow-edge-endpoint-source" />
          <circle className="flow-edge__endpoint" cx={targetX} cy={targetY} r="4.5" data-testid="flow-edge-endpoint-target" />
        </g>
      ) : null}
    </>
  );
}
