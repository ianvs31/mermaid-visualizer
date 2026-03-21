import { useEffect, useRef, useState } from "react";
import { HelpExportPopover } from "./HelpExportPopover";

interface ViewportControlsProps {
  zoom: number;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onCopyExport: (format: "drawio-xml" | "editor-json" | "markdown-mermaid") => void;
  onImportXmlText: (xmlText: string) => void;
  onImportXmlFile: (file: File) => void;
  onFitView: () => void;
  onReset: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
}

export function ViewportControls({
  zoom,
  snapToGrid,
  onToggleSnap,
  onCopyExport,
  onImportXmlText,
  onImportXmlFile,
  onFitView,
  onReset,
  onZoomOut,
  onZoomIn,
}: ViewportControlsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setHelpOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [helpOpen]);

  return (
    <div ref={rootRef} className="viewport-controls" role="toolbar" aria-label="视口控制">
      <div className="viewport-controls__zoom-group">
        <button className="viewport-controls__icon-button" onClick={onZoomOut} title="缩小" aria-label="缩小">
          <ViewportIcon type="minus" />
        </button>
        <span className="viewport-controls__divider" aria-hidden="true" />
        <button className="viewport-controls__icon-button" onClick={onZoomIn} title="放大" aria-label="放大">
          <ViewportIcon type="plus" />
        </button>
      </div>

      <div className="viewport-controls__help">
        <button
          className={`viewport-controls__help-button${helpOpen ? " is-active" : ""}`}
          onClick={() => setHelpOpen((open) => !open)}
          title="帮助与导出"
          aria-label="帮助与导出"
          aria-expanded={helpOpen}
        >
          ?
        </button>

        {helpOpen ? (
          <HelpExportPopover
            zoom={zoom}
            snapToGrid={snapToGrid}
            onToggleSnap={onToggleSnap}
            onCopyExport={(format) => {
              onCopyExport(format);
            }}
            onImportXmlText={(xmlText) => {
              onImportXmlText(xmlText);
              setHelpOpen(false);
            }}
            onImportXmlFile={(file) => {
              onImportXmlFile(file);
              setHelpOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ViewportIcon({ type }: { type: "minus" | "plus" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="viewport-controls__icon">
      <path
        d={type === "minus" ? "M6 12h12" : "M6 12h12M12 6v12"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
