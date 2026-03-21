import type { Connection } from "@xyflow/react";
import type { DiagramModel, DiagramNode, EdgeHandlePosition } from "./types";

export interface AutoHandleResult {
  sourceHandle: EdgeHandlePosition;
  targetHandle: EdgeHandlePosition;
}

interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pickAutoHandle(sourceNode: DiagramNode, targetNode: DiagramNode): AutoHandleResult {
  const source = toBox(sourceNode);
  const target = toBox(targetNode);
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  }

  return dy >= 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
}

export function validateConnection(
  connection: Pick<Connection, "source" | "target">,
  model: DiagramModel,
  opts: { ignoreEdgeId?: string } = {},
): { ok: boolean; reason?: string } {
  const source = (connection.source || "").trim();
  const target = (connection.target || "").trim();

  if (!source || !target) {
    return { ok: false, reason: "连线需要起点和终点" };
  }

  if (source === target) {
    return { ok: false, reason: "暂不支持节点自连接" };
  }

  const sourceNode = model.nodes.find((node) => node.id === source);
  const targetNode = model.nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) {
    return { ok: false, reason: "连接目标不存在" };
  }

  if (isInsideCollapsedGroup(sourceNode.id, model) || isInsideCollapsedGroup(targetNode.id, model)) {
    return { ok: false, reason: "分区折叠态下禁止连接子节点，请先展开分区" };
  }

  const duplicate = model.edges.find(
    (edge) => edge.id !== opts.ignoreEdgeId && edge.from === source && edge.to === target,
  );
  if (duplicate) {
    return { ok: false, reason: "该连线已存在" };
  }

  return { ok: true };
}

function toBox(node: DiagramNode): NodeBox {
  return {
    x: node.x,
    y: node.y,
    width: node.width ?? 148,
    height: node.height ?? 72,
  };
}

function center(box: NodeBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function isInsideCollapsedGroup(nodeId: string, model: DiagramModel): boolean {
  const node = model.nodes.find((item) => item.id === nodeId);
  if (!node?.parentGroupId) {
    return false;
  }

  let currentGroupId: string | undefined = node.parentGroupId;
  while (currentGroupId) {
    const group = model.groups.find((item) => item.id === currentGroupId);
    if (!group) {
      return false;
    }
    if (group.collapsed) {
      return true;
    }
    currentGroupId = group.parentGroupId;
  }

  return false;
}
