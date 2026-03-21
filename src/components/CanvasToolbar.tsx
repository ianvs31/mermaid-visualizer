import type { PointerEvent as ReactPointerEvent } from "react";
import { PALETTE_ITEMS, type PaletteItemId, type ToolbarIconName } from "../app/palette";
import type { ToolMode } from "../app/types";

interface CanvasToolbarProps {
  toolMode: ToolMode;
  laneDrawArmed?: boolean;
  onModeChange: (mode: ToolMode) => void;
  onActivatePaletteItem: (itemId: PaletteItemId) => void;
  onPalettePointerDown: (itemId: PaletteItemId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onAutoLayout: () => void;
}

const TOOL_ITEMS: Array<{ mode: ToolMode; label: string; icon: ToolbarIconName }> = [
  { mode: "select", label: "选择", icon: "select" },
  { mode: "pan", label: "手型", icon: "pan" },
];

const TOOLBAR_PALETTE_ITEMS = PALETTE_ITEMS.filter((item) => item.toolbarVisible);

export function CanvasToolbar(props: CanvasToolbarProps) {
  return (
    <div className="figjam-toolbar figjam-toolbar--bottom" role="toolbar" aria-label="画布工具条">
      {TOOL_ITEMS.map((item) => (
        <button
          key={item.mode}
          className={`figjam-toolbar__icon-button${props.toolMode === item.mode ? " is-active" : ""}`}
          onClick={() => props.onModeChange(item.mode)}
          title={item.label}
          aria-label={item.label}
        >
          <ToolbarIcon name={item.icon} />
        </button>
      ))}

      <span className="figjam-toolbar__divider" aria-hidden="true" />

      {TOOLBAR_PALETTE_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`figjam-toolbar__icon-button${item.id === "swimlane" && props.laneDrawArmed ? " is-active" : ""}`}
          onClick={() => props.onActivatePaletteItem(item.id)}
          onPointerDown={(event) => props.onPalettePointerDown(item.id, event)}
          title={item.label}
          aria-label={item.label}
        >
          <ToolbarIcon name={item.icon} />
        </button>
      ))}

      <span className="figjam-toolbar__divider" aria-hidden="true" />

      <button
        className="figjam-toolbar__icon-button"
        onClick={props.onAutoLayout}
        title="一键布局"
        aria-label="一键布局"
      >
        <ToolbarIcon name="layout" />
      </button>
    </div>
  );
}

function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  return (
    <svg className="figjam-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      {renderIcon(name)}
    </svg>
  );
}

function renderIcon(name: ToolbarIconName) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "select":
      return <path {...common} d="M5 4l5 12 2.5-4 4 2L20 11 8 6.5 5 4z" />;
    case "pan":
      return (
        <>
          <path {...common} d="M12 4v16M4 12h16" />
          <path {...common} d="M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3" />
        </>
      );
    case "rounded":
      return <rect x="4" y="7" width="16" height="10" rx="5" {...common} />;
    case "process":
      return <rect x="4" y="5" width="16" height="14" rx="3" {...common} />;
    case "decision":
      return <path {...common} d="M12 4l8 8-8 8-8-8 8-8z" />;
    case "swimlane":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="3" strokeDasharray="3 2" {...common} />
          <path {...common} d="M4 10h16" />
        </>
      );
    case "layout":
      return (
        <>
          <rect x="4" y="5" width="5" height="5" rx="1.2" {...common} />
          <rect x="15" y="5" width="5" height="5" rx="1.2" {...common} />
          <rect x="9.5" y="14" width="5" height="5" rx="1.2" {...common} />
          <path {...common} d="M9 7.5h6M12 10v4" />
        </>
      );
    default:
      return null;
  }
}
