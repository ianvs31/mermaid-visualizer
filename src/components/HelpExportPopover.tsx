import { useRef, type ChangeEvent } from "react";

interface HelpExportPopoverProps {
  zoom: number;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onCopyExport: (format: "drawio-xml" | "editor-json" | "markdown-mermaid") => void;
  onImportXmlText: (xmlText: string) => void;
  onImportXmlFile: (file: File) => void;
}

export function HelpExportPopover({
  zoom,
  snapToGrid,
  onToggleSnap,
  onCopyExport,
  onImportXmlText,
  onImportXmlFile,
}: HelpExportPopoverProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasteImport = () => {
    const xmlText = window.prompt("请粘贴 draw.io XML（mxGraphModel 或 mxfile）");
    if (xmlText === null) {
      return;
    }
    onImportXmlText(xmlText);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    onImportXmlFile(file);
  };

  return (
    <div className="help-export-popover" role="dialog" aria-label="帮助与导出">
      <section className="help-export-popover__section">
        <div className="help-export-popover__title">快捷键</div>
        {[
          ["Space", "平移"],
          ["Shift+1", "适配视图"],
          ["Shift+2", "重置 100%"],
          ["Ctrl/Cmd+0", "重置视口"],
          ["Delete / Backspace", "删除"],
          ["Ctrl/Cmd+Z", "撤销"],
          ["Ctrl/Cmd+Shift+Z", "重做"],
          ["Ctrl/Cmd+C / X / V", "复制、剪切、粘贴"],
        ].map(([shortcut, label]) => (
          <div key={shortcut} className="help-export-popover__row">
            <span>{label}</span>
            <kbd>{shortcut}</kbd>
          </div>
        ))}
      </section>

      <section className="help-export-popover__section">
        <div className="help-export-popover__title">导出复制</div>
        <button className="help-export-popover__action" onClick={() => onCopyExport("drawio-xml")}>复制 draw.io XML</button>
        <button className="help-export-popover__action" onClick={() => onCopyExport("editor-json")}>复制 JSON</button>
        <button className="help-export-popover__action" onClick={() => onCopyExport("markdown-mermaid")}>复制 Markdown</button>
      </section>

      <section className="help-export-popover__section">
        <div className="help-export-popover__title">导入 XML</div>
        <button className="help-export-popover__action" onClick={() => fileInputRef.current?.click()}>
          导入 draw.io 文件
        </button>
        <button className="help-export-popover__action" onClick={handlePasteImport}>
          粘贴 draw.io XML
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.drawio,text/xml,application/xml"
          hidden
          onChange={handleFileChange}
        />
      </section>

      <section className="help-export-popover__section">
        <div className="help-export-popover__title">画布设置</div>
        <div className="help-export-popover__row">
          <span>当前缩放</span>
          <strong>{Math.round(zoom * 100)}%</strong>
        </div>
        <label className="help-export-popover__toggle">
          <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} />
          <span>网格吸附</span>
        </label>
      </section>
    </div>
  );
}
