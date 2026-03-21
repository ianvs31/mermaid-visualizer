import type { ExportFormat } from "./export";

export function defaultFilenameFor(format: ExportFormat): string {
  if (format === "editor-json") {
    return "diagram.mermaid-visualizer.json";
  }
  if (format === "drawio-xml") {
    return "diagram.drawio.xml";
  }
  return "diagram.md";
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
