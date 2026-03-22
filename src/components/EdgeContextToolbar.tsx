import type { SyntheticEvent } from "react";
import type { StrokePattern } from "../app/types";

interface EdgeContextToolbarProps {
  visible: boolean;
  x: number;
  y: number;
  strokePattern: StrokePattern;
  onEditLabel: () => void;
  onSetStrokePattern: (strokePattern: StrokePattern) => void;
}

export function EdgeContextToolbar({
  visible,
  x,
  y,
  strokePattern,
  onEditLabel,
  onSetStrokePattern,
}: EdgeContextToolbarProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="figjam-toolbar figjam-toolbar--context"
      style={{ left: x, top: y }}
      role="toolbar"
      aria-label="连线操作"
      onPointerDown={stopUiEvent}
      onMouseDown={stopUiEvent}
      onClick={stopUiEvent}
    >
      <button
        type="button"
        className="context-trigger"
        aria-label="编辑标签"
        onPointerDown={stopUiEvent}
        onMouseDown={stopUiEvent}
        onClick={(event) => {
          stopUiEvent(event);
          onEditLabel();
        }}
      >
        <span className="context-trigger__label">编辑标签</span>
      </button>
      <button
        type="button"
        className={`context-trigger${strokePattern === "solid" ? " is-active" : ""}`}
        aria-label="实线"
        onPointerDown={stopUiEvent}
        onMouseDown={stopUiEvent}
        onClick={(event) => {
          stopUiEvent(event);
          onSetStrokePattern("solid");
        }}
      >
        <span className="context-trigger__visual">
          <span className="context-trigger__stroke-preview" />
        </span>
        <span className="context-trigger__label">实线</span>
      </button>
      <button
        type="button"
        className={`context-trigger${strokePattern === "dashed" ? " is-active" : ""}`}
        aria-label="虚线"
        onPointerDown={stopUiEvent}
        onMouseDown={stopUiEvent}
        onClick={(event) => {
          stopUiEvent(event);
          onSetStrokePattern("dashed");
        }}
      >
        <span className="context-trigger__visual">
          <span className="context-trigger__stroke-preview is-dashed" />
        </span>
        <span className="context-trigger__label">虚线</span>
      </button>
    </div>
  );
}

function stopUiEvent(event: SyntheticEvent) {
  event.stopPropagation();
}
