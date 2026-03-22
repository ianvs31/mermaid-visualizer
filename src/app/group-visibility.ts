import type { DiagramEdge, DiagramGroup, DiagramModel } from "./types";

export interface GroupVisibilityState {
  collapsedGroupIds: Set<string>;
  hiddenGroupIds: Set<string>;
  hiddenNodeIds: Set<string>;
  hiddenEdgeIds: Set<string>;
}

export function buildHiddenGroupIds(groups: DiagramGroup[]): Set<string> {
  const collapsedGroupIds = new Set(groups.filter((group) => group.collapsed).map((group) => group.id));
  const hiddenGroupIds = new Set<string>();

  for (const group of groups) {
    if (!group.collapsed) {
      continue;
    }
    for (const childGroupId of collectDescendantGroups(group.id, groups)) {
      hiddenGroupIds.add(childGroupId);
    }
  }

  return hiddenGroupIds;
}

export function buildGroupVisibility(model: Pick<DiagramModel, "groups" | "nodes" | "edges">): GroupVisibilityState {
  const collapsedGroupIds = new Set(model.groups.filter((group) => group.collapsed).map((group) => group.id));
  const hiddenGroupIds = buildHiddenGroupIds(model.groups);
  const hiddenNodeIds = new Set<string>();

  for (const node of model.nodes) {
    if (node.parentGroupId && (collapsedGroupIds.has(node.parentGroupId) || hiddenGroupIds.has(node.parentGroupId))) {
      hiddenNodeIds.add(node.id);
    }
  }

  const hiddenEdgeIds = new Set<string>();
  for (const edge of model.edges) {
    if (hiddenNodeIds.has(edge.from) || hiddenNodeIds.has(edge.to)) {
      hiddenEdgeIds.add(edge.id);
    }
  }

  return { collapsedGroupIds, hiddenGroupIds, hiddenNodeIds, hiddenEdgeIds };
}

export function isGroupVisible(group: DiagramGroup, hiddenGroupIds: Set<string>): boolean {
  return !group.collapsed && !hiddenGroupIds.has(group.id);
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
