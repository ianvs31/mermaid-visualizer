import type { DiagramGroup, DiagramModel, DiagramNode, DiagramNodeType } from "./types";
import { buildStyleFromAppearance } from "./appearance";

export function serializeMermaidFlowchartV2(model: DiagramModel): string {
  const lines: string[] = [];
  lines.push(`flowchart ${model.direction}`);

  const groupsByParent = new Map<string | undefined, DiagramGroup[]>();
  for (const group of model.groups) {
    const key = group.parentGroupId;
    const list = groupsByParent.get(key) || [];
    list.push(group);
    groupsByParent.set(key, list);
  }

  const nodesByParent = new Map<string | undefined, DiagramNode[]>();
  for (const node of model.nodes) {
    const key = node.parentGroupId;
    const list = nodesByParent.get(key) || [];
    list.push(node);
    nodesByParent.set(key, list);
  }

  emitScope(lines, undefined, 1, groupsByParent, nodesByParent);

  for (const edge of model.edges) {
    lines.push(`  ${serializeEdge(edge)}`);
  }

  for (const node of model.nodes) {
    if (node.classNames?.length) {
      lines.push(`  class ${node.id} ${node.classNames.join(" ")}`);
    }
  }

  for (const node of model.nodes) {
    if (node.label === "") {
      lines.push(`  %% editor:empty-label ${node.id}`);
    }

    if (node.appearance) {
      lines.push(
        `  %% editor:appearance ${node.id} fillMode=${node.appearance.fillMode} fillColor=${node.appearance.fillColor} strokeColor=${node.appearance.strokeColor} strokePattern=${node.appearance.strokePattern} radius=${node.appearance.cornerRadius} width=${node.appearance.strokeWidth}`,
      );
    }

    const style = styleToString({
      ...(node.appearance ? buildStyleFromAppearance(node.appearance) : {}),
      ...(node.style || {}),
    });
    if (style) {
      lines.push(`  style ${node.id} ${style}`);
    }
  }

  for (const raw of model.rawPassthroughStatements) {
    lines.push(`  ${raw}`);
  }

  return lines.join("\n");
}

function emitScope(
  lines: string[],
  parentGroupId: string | undefined,
  depth: number,
  groupsByParent: Map<string | undefined, DiagramGroup[]>,
  nodesByParent: Map<string | undefined, DiagramNode[]>,
): void {
  const indent = "  ".repeat(depth);
  const groups = (groupsByParent.get(parentGroupId) || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const nodes = (nodesByParent.get(parentGroupId) || []).slice().sort((a, b) => a.id.localeCompare(b.id));

  for (const group of groups) {
    if (group.type === "swimlane" && group.laneMeta) {
      lines.push(
        `${indent}%% editor:lane ${group.id} ${group.laneMeta.orientation} ${group.laneMeta.order}`,
      );
    }

    const title = group.title ? `[${escapeMermaid(group.title)}]` : "";
    lines.push(`${indent}subgraph ${group.id}${title}`);

    if (group.direction) {
      lines.push(`${indent}  direction ${group.direction}`);
    }

    emitScope(lines, group.id, depth + 1, groupsByParent, nodesByParent);
    lines.push(`${indent}end`);
  }

  for (const node of nodes) {
    lines.push(`${indent}${node.id}${shapeOf(node.type, serializeNodeLabel(node.label))}`);
  }
}

function shapeOf(type: DiagramNodeType, label: string): string {
  if (type === "decision") {
    return `{${label}}`;
  }
  if (type === "start" || type === "terminator") {
    return `([${label}])`;
  }
  if (type === "custom") {
    return `[${label}]`;
  }
  return `[${label}]`;
}

function serializeEdge(edge: DiagramModel["edges"][number]): string {
  const label = edge.label?.trim() ? escapeMermaid(edge.label) : "";
  if (edge.strokePattern === "dashed") {
    if (label) {
      return `${edge.from} -. ${label} .-> ${edge.to}`;
    }
    return `${edge.from} -.-> ${edge.to}`;
  }
  if (label) {
    return `${edge.from} -->|${label}| ${edge.to}`;
  }
  return `${edge.from} --> ${edge.to}`;
}

function serializeNodeLabel(label: string): string {
  if (label === "") {
    return " ";
  }
  return escapeMermaid(label);
}

function styleToString(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

function escapeMermaid(text: string): string {
  return String(text ?? "")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll("\"", "'")
    .trim();
}
