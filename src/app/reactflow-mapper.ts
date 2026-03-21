import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import { deriveNodePaint, resolveNodeAppearance } from "./appearance";
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
  onGroupResizeEnd?: (groupId: string, width: number, height: number) => void;
  onToggleGroupCollapse?: (groupId: string) => void;
}

export function modelToFlowElements(model: DiagramModel, options: FlowMapOptions = {}): FlowElementSet {
  const groupMap = new Map(model.groups.map((group) => [group.id, group]));
  const hiddenGroups = new Set<string>();
  const selectedNodeIds = new Set(options.selectedNodeIds || []);
  const selectedEdgeIds = new Set(options.selectedEdgeIds || []);
  const selectedGroupIds = new Set(options.selectedGroupIds || []);
  const hasMixedSelection =
    (options.selectedNodeIds?.length ?? 0) > 1 ||
    (options.selectedEdgeIds?.length ?? 0) > 0 ||
    (options.selectedGroupIds?.length ?? 0) > 0;
  const quickConnectEnabled = options.toolMode === "select" && !hasMixedSelection;

  for (const group of model.groups) {
    if (!group.collapsed) {
      continue;
    }
    hiddenGroups.add(group.id);
    for (const child of collectDescendantGroups(group.id, model.groups)) {
      hiddenGroups.add(child);
    }
  }

  const nodes: Node[] = [];

  for (const group of model.groups) {
    const parent = group.parentGroupId ? groupMap.get(group.parentGroupId) : undefined;
    const hidden = parent ? hiddenGroups.has(parent.id) : false;

    nodes.push({
      id: group.id,
      type: "groupNode",
      data: {
        title: group.title,
        groupType: group.type,
        collapsed: !!group.collapsed,
        childCount: group.childNodeIds.length + group.childGroupIds.length,
        onResizeEnd: options.onGroupResizeEnd,
        onToggleCollapse: options.onToggleGroupCollapse,
      },
      position: toRelativePosition(group.x, group.y, parent),
      parentId: parent?.id,
      extent: parent ? "parent" : undefined,
      draggable: true,
      selectable: true,
      width: group.width,
      height: group.collapsed ? 56 : group.height,
      selected: selectedGroupIds.has(group.id),
      style: {
        zIndex: 1,
      },
      className: group.type === "swimlane" ? "rf-group rf-group--lane" : "rf-group rf-group--subgraph",
      hidden,
    });
  }

  const hiddenNodes = new Set<string>();

  for (const node of model.nodes) {
    const parent = node.parentGroupId ? groupMap.get(node.parentGroupId) : undefined;
    const hidden = parent ? hiddenGroups.has(parent.id) : false;
    if (hidden) {
      hiddenNodes.add(node.id);
    }
    const size = {
      width: node.width ?? defaultNodeSize(node.type).width,
      height: node.height ?? defaultNodeSize(node.type).height,
    };

    nodes.push({
      id: node.id,
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
      parentId: parent?.id,
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
    });
  }

  const edges: Edge[] = model.edges.map((edge) => {
    const hidden = hiddenNodes.has(edge.from) || hiddenNodes.has(edge.to);
    return edgeToFlow(edge, hidden, selectedEdgeIds.has(edge.id));
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

function edgeToFlow(edge: DiagramEdge, hidden: boolean, selected: boolean): Edge {
  return {
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: "smoothstep",
    sourceHandle: edge.sourceHandle ?? "right",
    targetHandle: edge.targetHandle ?? "left",
    animated: false,
    className: "rf-edge",
    data: {
      hiddenByCollapsedGroup: hidden,
    },
    style: {
      strokeWidth: 2,
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

function defaultNodeSize(type: DiagramNode["type"]): { width: number; height: number } {
  if (type === "decision") {
    return { width: 132, height: 132 };
  }
  if (type === "start" || type === "terminator") {
    return { width: 130, height: 66 };
  }
  return { width: 148, height: 72 };
}

function collectDescendantGroups(groupId: string, groups: DiagramGroup[]): string[] {
  const descendants: string[] = [];
  const queue = [groupId];

  while (queue.length) {
    const current = queue.shift()!;
    const children = groups.filter((group) => group.parentGroupId === current).map((group) => group.id);
    descendants.push(...children);
    queue.push(...children);
  }

  return descendants;
}
