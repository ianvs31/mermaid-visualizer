import { deriveNodePaint, resolveNodeAppearance } from "./appearance";
import { serializeMermaidFlowchartV2 } from "./serializer";
import type { DiagramModel } from "./types";

export type ExportFormat = "drawio-xml" | "editor-json" | "markdown-mermaid";

export interface EditorExportBundleV1 {
  version: 1;
  exportedAt: string;
  format: "mermaid-visualizer";
  mermaid: string;
  model: DiagramModel;
}

export function buildMarkdownMermaid(model: DiagramModel): string {
  return `\`\`\`mermaid\n${serializeMermaidFlowchartV2(model)}\n\`\`\`\n`;
}

export function buildEditorExportBundle(model: DiagramModel): EditorExportBundleV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    format: "mermaid-visualizer",
    mermaid: serializeMermaidFlowchartV2(model),
    model: structuredClone(model),
  };
}

export function buildDrawioXml(model: DiagramModel): string {
  const cells: string[] = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
  ];

  for (const group of model.groups) {
    const value = escapeXml(group.title);
    cells.push(
      `<mxCell id="${group.id}" value="${value}" style="swimlane;rounded=1;whiteSpace=wrap;html=1;fillColor=#f9fafb;strokeColor=#94a3b8;" vertex="1" parent="1"><mxGeometry x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" as="geometry" /></mxCell>`,
    );
  }

  for (const node of model.nodes) {
    const appearance = resolveNodeAppearance(node);
    const paint = deriveNodePaint(appearance);
    const width = node.width ?? (node.type === "decision" ? 132 : node.type === "start" || node.type === "terminator" ? 130 : 148);
    const height = node.height ?? (node.type === "decision" ? 132 : 72);
    const parent = node.parentGroupId ?? "1";
    const x = node.parentGroupId
      ? node.x - (model.groups.find((group) => group.id === node.parentGroupId)?.x ?? 0)
      : node.x;
    const y = node.parentGroupId
      ? node.y - (model.groups.find((group) => group.id === node.parentGroupId)?.y ?? 0)
      : node.y;

    const shapeStyle =
      node.type === "decision"
        ? "rhombus;"
        : node.type === "start" || node.type === "terminator"
          ? "rounded=1;arcSize=50;"
          : "rounded=0;";

    const fillColor = appearance.fillMode === "none" ? "none" : appearance.fillColor;
    const fillOpacity = appearance.fillMode === "transparent" ? "18" : "100";
    const dashed = appearance.strokePattern === "dashed" ? "dashed=1;" : "";

    cells.push(
      `<mxCell id="${node.id}" value="${escapeXml(node.label)}" style="${shapeStyle}whiteSpace=wrap;html=1;fillColor=${fillColor};fillOpacity=${fillOpacity};strokeColor=${appearance.strokeColor};strokeWidth=${paint.strokeWidth};${dashed}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" /></mxCell>`,
    );
  }

  for (const edge of model.edges) {
    const dashed = edge.style?.["stroke-dasharray"] ? "dashed=1;" : "";
    cells.push(
      `<mxCell id="${edge.id}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;${dashed}" edge="1" parent="1" source="${edge.from}" target="${edge.to}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  }

  return `<mxGraphModel dx="1280" dy="720" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0"><root>${cells.join("")}</root></mxGraphModel>`;
}

export function buildExportText(format: ExportFormat, model: DiagramModel): string {
  if (format === "markdown-mermaid") {
    return buildMarkdownMermaid(model);
  }
  if (format === "editor-json") {
    return JSON.stringify(buildEditorExportBundle(model), null, 2);
  }
  return buildDrawioXml(model);
}

export async function copyExportToClipboard(format: ExportFormat, model: DiagramModel): Promise<void> {
  const text = buildExportText(format, model);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function escapeXml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
