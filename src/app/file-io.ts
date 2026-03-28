import type { ExportFormat } from "./export";

export function defaultFilenameFor(format: ExportFormat, title: string): string {
  const stem = sanitizeFilenameStem(title);
  if (format === "editor-json") {
    return `${stem}.mermaid-visualizer.json`;
  }
  if (format === "drawio-xml") {
    return `${stem}.drawio.xml`;
  }
  return `${stem}.md`;
}

export function downloadTextFile(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilenameStem(title: string): string {
  const collapsed = title.trim().replace(/\s+/g, "-");
  const sanitized = collapsed.replace(/[\\/:*?"<>|]/g, "");
  return sanitized || "untitled-diagram";
}
