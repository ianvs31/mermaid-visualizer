import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import { deriveNodePaint, resolveNodeAppearance } from "./appearance";
import { buildGroupVisibility } from "./group-visibility";
import { getDefaultNodeSize } from "./node-geometry";
import type {
  DiagramEdge,
  DiagramGroup,
  DiagramModel,
  DiagramNode,
  ToolMode,
} from "./types";

export interface FlowElementSet {
  nodes: Node[];
  edges: Edge[];
}

export interface FlowMapOptions {
  toolMode?: ToolMode;
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  selectedGroupIds?: string[];
  connectingNodeId?: string | null;
  flowNamespace?: string;
  onGroupResizeEnd?: (groupId: string, width: number, height: number) => void;
  onToggleGroupCollapse?: (groupId: string) => void;
}

const DEFAULT_FLOW_NAMESPACE = "boot";
const FLOW_ID_SEPARATOR = "::";

type FlowElementKind = "node" | "group" | "edge";

export function modelToFlowElements(model: DiagramModel, options: FlowMapOptions = {}): FlowElementSet {
  const groupMap = new Map(model.groups.map((group) => [group.id, group]));
  const visibility = buildGroupVisibility(model);
  const flowNamespace = options.flowNamespace ?? DEFAULT_FLOW_NAMESPACE;
  const selectedNodeIds = new Set(options.selectedNodeIds || []);
  const selectedEdgeIds = new Set(options.selectedEdgeIds || []);
  const selectedGroupIds = new Set(options.selectedGroupIds || []);
  const hasMixedSelection =
    (options.selectedNodeIds?.length ?? 0) > 1 ||
    (options.selectedEdgeIds?.length ?? 0) > 0 ||
    (options.selectedGroupIds?.length ?? 0) > 0;
  const quickConnectEnabled = options.toolMode === "select" && !hasMixedSelection;

  const nodes: Node[] = [];

  for (const group of model.groups) {
    const parent = group.parentGroupId ? groupMap.get(group.parentGroupId) : undefined;
    const hidden =
      visibility.hiddenGroupIds.has(group.id) ||
      (parent ? visibility.hiddenGroupIds.has(parent.id) || visibility.collapsedGroupIds.has(parent.id) : false);

    nodes.push({
      id: toFlowElementId(flowNamespace, "group", group.id),
      type: "groupNode",
      data: {
        groupId: group.id,
        title: group.title,
        groupType: group.type,
        collapsed: !!group.collapsed,
        childCount: group.childNodeIds.length + group.childGroupIds.length,
        onResizeEnd: options.onGroupResizeEnd,
        onToggleCollapse: options.onToggleGroupCollapse,
      },
      position: toRelativePosition(group.x, group.y, parent),
      parentId: parent ? toFlowElementId(flowNamespace, "group", parent.id) : undefined,
      extent: parent ? "parent" : undefined,
      draggable: true,
      selectable: true,
      width: group.width,
      height: group.collapsed ? 56 : group.height,
      selected: selectedGroupIds.has(group.id),
      style: {
        zIndex: 1,
        pointerEvents: "none",
      },
      domAttributes: createNodeDomAttributes(group.id, "group"),
      className: group.type === "swimlane" ? "rf-group rf-group--lane" : "rf-group rf-group--subgraph",
      hidden,
    });
  }

  for (const node of model.nodes) {
    const parent = node.parentGroupId ? groupMap.get(node.parentGroupId) : undefined;
    const hidden =
      visibility.hiddenNodeIds.has(node.id) ||
      (parent ? visibility.hiddenGroupIds.has(parent.id) || visibility.collapsedGroupIds.has(parent.id) : false);
    const size = {
      width: node.width ?? getDefaultNodeSize(node.type).width,
      height: node.height ?? getDefaultNodeSize(node.type).height,
    };

    nodes.push({
      id: toFlowElementId(flowNamespace, "node", node.id),
      type: "flowNode",
      data: {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        paint: deriveNodePaint(resolveNodeAppearance(node)),
        quickConnectEnabled,
        connectCandidate:
          !!options.connectingNodeId &&
          options.connectingNodeId !== node.id,
      },
      position: toRelativePosition(node.x, node.y, parent),
      parentId: parent ? toFlowElementId(flowNamespace, "group", parent.id) : undefined,
      className: `rf-node rf-node--${node.type}`,
      hidden,
      draggable: true,
      selectable: true,
      selected: selectedNodeIds.has(node.id),
      width: size.width,
      height: size.height,
      handles: [
        {
          id: "left",
          type: "target",
          position: Position.Left,
          x: 0,
          y: Math.max(8, Math.round(size.height / 2 - 6)),
          width: 12,
          height: 12,
        },
        {
          id: "right",
          type: "source",
          position: Position.Right,
          x: Math.max(8, size.width - 12),
          y: Math.max(8, Math.round(size.height / 2 - 6)),
          width: 12,
          height: 12,
        },
        {
          id: "top",
          type: "target",
          position: Position.Top,
          x: Math.max(8, Math.round(size.width / 2 - 6)),
          y: 0,
          width: 12,
          height: 12,
        },
        {
          id: "bottom",
          type: "source",
          position: Position.Bottom,
          x: Math.max(8, Math.round(size.width / 2 - 6)),
          y: Math.max(8, size.height - 12),
          width: 12,
          height: 12,
        },
      ],
      style: { zIndex: 4 },
      domAttributes: createNodeDomAttributes(node.id, "node"),
    });
  }

  const edges: Edge[] = model.edges.map((edge) => {
    const hidden = visibility.hiddenEdgeIds.has(edge.id);
    return edgeToFlow(edge, hidden, selectedEdgeIds.has(edge.id), flowNamespace);
  });

  return { nodes, edges };
}

export function applyFlowNodePosition(
  target: DiagramNode | DiagramGroup,
  position: { x: number; y: number },
  parent: DiagramGroup | undefined,
): { x: number; y: number } {
  if (!parent) {
    return position;
  }

  return {
    x: parent.x + position.x,
    y: parent.y + position.y,
  };
}

function edgeToFlow(edge: DiagramEdge, hidden: boolean, selected: boolean, flowNamespace: string): Edge {
  return {
    id: toFlowElementId(flowNamespace, "edge", edge.id),
    source: toFlowElementId(flowNamespace, "node", edge.from),
    target: toFlowElementId(flowNamespace, "node", edge.to),
    label: edge.label,
    type: "flowEdge",
    sourceHandle: edge.sourceHandle ?? "right",
    targetHandle: edge.targetHandle ?? "left",
    animated: false,
    className: "rf-edge",
    data: {
      edgeId: edge.id,
      hiddenByCollapsedGroup: hidden,
      showEndpointHints: selected,
    },
    domAttributes: createEdgeDomAttributes(edge.id),
    interactionWidth: 28,
    style: {
      strokeWidth: 2,
      strokeDasharray: edge.strokePattern === "dashed" ? "6 4" : undefined,
    },
    labelShowBg: !!edge.label?.trim(),
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
    labelBgStyle: {
      fill: "rgba(255, 255, 255, 0.92)",
      stroke: "rgba(15, 23, 42, 0.1)",
      strokeWidth: 1,
    },
    labelStyle: {
      fill: "#0f172a",
      fontSize: 12,
      fontWeight: 600,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
    },
    selected,
    hidden,
  };
}

function toRelativePosition(
  x: number,
  y: number,
  parent: DiagramGroup | undefined,
): { x: number; y: number } {
  if (!parent) {
    return { x, y };
  }

  return {
    x: x - parent.x,
    y: y - parent.y,
  };
}

export function getFlowNamespace(documentId?: string): string {
  return documentId || DEFAULT_FLOW_NAMESPACE;
}

function createNodeDomAttributes(modelId: string, kind: "node" | "group"): NonNullable<Node["domAttributes"]> {
  return {
    ["data-model-id"]: modelId,
    ["data-model-kind"]: kind,
  } as NonNullable<Node["domAttributes"]>;
}

function createEdgeDomAttributes(modelId: string): NonNullable<Edge["domAttributes"]> {
  return {
    ["data-model-id"]: modelId,
    ["data-model-kind"]: "edge",
  } as NonNullable<Edge["domAttributes"]>;
}

export function getModelNodeId(source: { id?: string; data?: unknown } | string | null | undefined): string | undefined {
  if (typeof source === "string") {
    const parsed = parseFlowElementId(source);
    return parsed?.kind === "node" ? parsed.modelId : undefined;
  }

  const typedData = source?.data as { nodeId?: unknown } | undefined;
  return typeof typedData?.nodeId === "string" ? typedData.nodeId : getModelNodeId(source?.id);
}

export function getModelGroupId(source: { id?: string; data?: unknown } | string | null | undefined): string | undefined {
  if (typeof source === "string") {
    const parsed = parseFlowElementId(source);
    return parsed?.kind === "group" ? parsed.modelId : undefined;
  }

  const typedData = source?.data as { groupId?: unknown } | undefined;
  return typeof typedData?.groupId === "string" ? typedData.groupId : getModelGroupId(source?.id);
}

export function getModelEdgeId(source: { id?: string; data?: unknown } | string | null | undefined): string | undefined {
  if (typeof source === "string") {
    const parsed = parseFlowElementId(source);
    return parsed?.kind === "edge" ? parsed.modelId : undefined;
  }

  const typedData = source?.data as { edgeId?: unknown } | undefined;
  return typeof typedData?.edgeId === "string" ? typedData.edgeId : getModelEdgeId(source?.id);
}

function toFlowElementId(namespace: string, kind: FlowElementKind, modelId: string): string {
  return `${namespace}${FLOW_ID_SEPARATOR}${kind}${FLOW_ID_SEPARATOR}${modelId}`;
}

function parseFlowElementId(flowId?: string | null): { namespace: string; kind: FlowElementKind; modelId: string } | null {
  if (!flowId) {
    return null;
  }

  const firstSeparator = flowId.indexOf(FLOW_ID_SEPARATOR);
  const secondSeparator = flowId.indexOf(FLOW_ID_SEPARATOR, firstSeparator + FLOW_ID_SEPARATOR.length);
  if (firstSeparator < 0 || secondSeparator < 0) {
    return null;
  }

  const namespace = flowId.slice(0, firstSeparator);
  const kind = flowId.slice(firstSeparator + FLOW_ID_SEPARATOR.length, secondSeparator);
  const modelId = flowId.slice(secondSeparator + FLOW_ID_SEPARATOR.length);

  if ((kind !== "node" && kind !== "group" && kind !== "edge") || !modelId) {
    return null;
  }

  return {
    namespace,
    kind,
    modelId,
  };
}
