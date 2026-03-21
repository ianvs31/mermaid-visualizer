import type { DiagramModel, Direction, LayoutOptions } from "./types";

let elkPromise: Promise<{ layout: (graph: any) => Promise<any> }> | null = null;

async function loadElk() {
  elkPromise ??= import("elkjs/lib/elk.bundled.js").then((module) => new module.default());
  return elkPromise;
}

const DIRECTION_MAP: Record<Direction, string> = {
  LR: "RIGHT",
  RL: "LEFT",
  TB: "DOWN",
  TD: "DOWN",
  BT: "UP",
};

export async function applyElkLayout(
  model: DiagramModel,
  opts: LayoutOptions = {},
): Promise<DiagramModel> {
  const direction = opts.direction ?? model.direction;
  const layerSpacing = opts.layerSpacing ?? 90;
  const nodeSpacing = opts.nodeSpacing ?? 52;

  const groupsByParent = new Map<string | undefined, string[]>();
  for (const group of model.groups) {
    const key = group.parentGroupId;
    const list = groupsByParent.get(key) || [];
    list.push(group.id);
    groupsByParent.set(key, list);
  }

  const nodesByParent = new Map<string | undefined, string[]>();
  for (const node of model.nodes) {
    const key = node.parentGroupId;
    const list = nodesByParent.get(key) || [];
    list.push(node.id);
    nodesByParent.set(key, list);
  }

  const groupMap = new Map(model.groups.map((group) => [group.id, group]));
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));

  const elkRoot: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": DIRECTION_MAP[direction],
      "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSpacing),
      "elk.spacing.nodeNode": String(nodeSpacing),
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: buildScopeChildren(undefined, groupsByParent, nodesByParent, groupMap, nodeMap),
    edges: model.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
      labels: edge.label ? [{ text: edge.label }] : undefined,
    })),
  };

  let layouted: any;
  try {
    const elk = await loadElk();
    layouted = await elk.layout(elkRoot);
  } catch {
    return model;
  }

  const next = structuredClone(model) as DiagramModel;
  const positionedNodes = new Map<string, { x: number; y: number; width?: number; height?: number }>();
  const positionedGroups = new Map<string, { x: number; y: number; width?: number; height?: number }>();

  collectPositions(layouted, 0, 0, positionedNodes, positionedGroups);

  next.nodes = next.nodes.map((node) => {
    const pos = positionedNodes.get(node.id);
    if (!pos) {
      return node;
    }
    return {
      ...node,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: pos.width ? Math.round(pos.width) : node.width,
      height: pos.height ? Math.round(pos.height) : node.height,
    };
  });

  next.groups = next.groups.map((group) => {
    const pos = positionedGroups.get(group.id);
    if (!pos) {
      return group;
    }
    return {
      ...group,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: pos.width ? Math.max(240, Math.round(pos.width)) : group.width,
      height: pos.height ? Math.max(160, Math.round(pos.height)) : group.height,
    };
  });

  return next;
}

function buildScopeChildren(
  parentGroupId: string | undefined,
  groupsByParent: Map<string | undefined, string[]>,
  nodesByParent: Map<string | undefined, string[]>,
  groupMap: Map<string, DiagramModel["groups"][number]>,
  nodeMap: Map<string, DiagramModel["nodes"][number]>,
): any[] {
  const children: any[] = [];

  for (const groupId of groupsByParent.get(parentGroupId) || []) {
    const group = groupMap.get(groupId);
    if (!group) {
      continue;
    }

    children.push({
      id: group.id,
      width: group.width || 420,
      height: group.height || 220,
      children: buildScopeChildren(group.id, groupsByParent, nodesByParent, groupMap, nodeMap),
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": DIRECTION_MAP[group.direction || "LR"],
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.padding": "[top=36,left=20,bottom=20,right=20]",
      },
    });
  }

  for (const nodeId of nodesByParent.get(parentGroupId) || []) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }

    children.push({
      id: node.id,
      width: node.width || defaultNodeWidth(node.type),
      height: node.height || defaultNodeHeight(node.type),
    });
  }

  return children;
}

function collectPositions(
  elkNode: any,
  parentX: number,
  parentY: number,
  nodeOut: Map<string, { x: number; y: number; width?: number; height?: number }>,
  groupOut: Map<string, { x: number; y: number; width?: number; height?: number }>,
): void {
  const absoluteX = parentX + (elkNode.x || 0);
  const absoluteY = parentY + (elkNode.y || 0);

  if (elkNode.id && elkNode.id !== "root") {
    const hasChildren = Array.isArray(elkNode.children) && elkNode.children.length > 0;
    if (hasChildren) {
      groupOut.set(elkNode.id, {
        x: absoluteX,
        y: absoluteY,
        width: elkNode.width,
        height: elkNode.height,
      });
    } else {
      nodeOut.set(elkNode.id, {
        x: absoluteX,
        y: absoluteY,
        width: elkNode.width,
        height: elkNode.height,
      });
    }
  }

  for (const child of elkNode.children || []) {
    collectPositions(child, absoluteX, absoluteY, nodeOut, groupOut);
  }
}

function defaultNodeWidth(type: string): number {
  if (type === "decision") {
    return 132;
  }
  return 148;
}

function defaultNodeHeight(type: string): number {
  if (type === "decision") {
    return 132;
  }
  return 72;
}
