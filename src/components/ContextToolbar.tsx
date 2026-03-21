import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import type { DerivedNodePaint } from "../app/appearance";
import type { MixedValue, SelectionAppearanceSummary } from "../app/selection-appearance";
import type { FillMode, NodeAppearance, StrokePattern } from "../app/types";
import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { SegmentedModes, StylePopover } from "./StylePopover";

type PopoverKey = "fill" | "stroke" | null;

interface ContextToolbarProps {
  visible: boolean;
  x: number;
  y: number;
  mode: "single" | "multi";
  appearance: NodeAppearance | SelectionAppearanceSummary;
  paint?: DerivedNodePaint;
  disabled?: boolean;
  onDisabledIntent?: () => void;
  onPopoverOpenChange?: (open: boolean) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetFillMode: (mode: FillMode) => void;
  onSetStrokePattern: (pattern: StrokePattern) => void;
}

export function ContextToolbar(props: ContextToolbarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.visible) {
      setOpenPopover(null);
    }
  }, [props.visible]);

  useEffect(() => {
    props.onPopoverOpenChange?.(openPopover !== null);
  }, [openPopover, props.onPopoverOpenChange]);

  useEffect(() => {
    if (!openPopover) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPopover(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openPopover]);

  if (!props.visible) {
    return null;
  }

  const handleToggle = (key: PopoverKey) => {
    if (props.disabled) {
      props.onDisabledIntent?.();
      return;
    }
    setOpenPopover((value) => (value === key ? null : key));
  };

  return (
    <div
      ref={rootRef}
      className="figjam-toolbar figjam-toolbar--context"
      style={{ left: props.x, top: props.y }}
      role="toolbar"
      aria-label="选中对象上下文工具条"
      onPointerDown={stopEvent}
      onMouseDown={stopEvent}
      onClick={stopEvent}
      onDoubleClick={stopEvent}
    >
      <ToolbarTrigger
        label={fillTriggerLabel(props.appearance)}
        active={openPopover === "fill"}
        disabled={props.disabled}
        onClick={() => handleToggle("fill")}
      >
        <span
          className="context-trigger__fill-preview"
          style={{
            background:
              props.mode === "single" && props.paint
                ? props.paint.fill
                : props.appearance.fillColor === "mixed"
                  ? "linear-gradient(135deg, #5fa1ef 0%, #eb5c33 100%)"
                  : props.appearance.fillColor,
            borderColor:
              props.appearance.strokeColor === "mixed"
                ? "#8c8c8c"
                : props.appearance.strokeColor,
          }}
        />
      </ToolbarTrigger>

      <ToolbarTrigger
        label={strokeTriggerLabel(props.appearance)}
        active={openPopover === "stroke"}
        disabled={props.disabled}
        onClick={() => handleToggle("stroke")}
      >
        <span
          className={`context-trigger__stroke-preview${props.appearance.strokePattern === "dashed" ? " is-dashed" : ""}${props.appearance.strokePattern === "mixed" ? " is-mixed" : ""}`}
          style={{
            borderColor:
              props.appearance.strokeColor === "mixed"
                ? "#8c8c8c"
                : props.appearance.strokeColor,
          }}
        />
      </ToolbarTrigger>

      {openPopover === "fill" ? (
        <StylePopover className="style-popover--fill" title="Fill">
          <SegmentedModes
            value={props.appearance.fillMode}
            onChange={props.onSetFillMode}
            options={[
              { value: "solid", label: "填充", icon: <SquareIcon /> },
              { value: "transparent", label: "半透明", icon: <TransparentIcon /> },
              { value: "none", label: "不填充", icon: <NoFillIcon /> },
            ]}
          />
          <ColorSwatchGrid selected={props.appearance.fillColor} onPick={props.onSetFillColor} />
        </StylePopover>
      ) : null}

      {openPopover === "stroke" ? (
        <StylePopover className="style-popover--stroke" title="Stroke">
          <SegmentedModes
            value={props.appearance.strokePattern}
            onChange={props.onSetStrokePattern}
            options={[
              { value: "solid", label: "实线", icon: <SolidStrokeIcon /> },
              { value: "dashed", label: "虚线", icon: <DashedStrokeIcon /> },
            ]}
          />
          <ColorSwatchGrid selected={props.appearance.strokeColor} onPick={props.onSetStrokeColor} />
        </StylePopover>
      ) : null}
    </div>
  );
}

function ToolbarTrigger({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`context-trigger${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-disabled={disabled}
    >
      <span className="context-trigger__visual">{children}</span>
      <span className="context-trigger__label">{label}</span>
      <span className="context-trigger__caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}

function fillModeLabel(mode: FillMode | MixedValue): string {
  if (mode === "mixed") {
    return "混合";
  }
  if (mode === "transparent") {
    return "半透明";
  }
  if (mode === "none") {
    return "不填充";
  }
  return "填充";
}

function strokePatternLabel(pattern: StrokePattern | MixedValue): string {
  if (pattern === "mixed") {
    return "混合";
  }
  return pattern === "dashed" ? "虚线" : "实线";
}

function fillTriggerLabel(appearance: NodeAppearance | SelectionAppearanceSummary): string {
  if (appearance.fillMode === "mixed" || appearance.fillColor === "mixed") {
    return "混合";
  }
  return fillModeLabel(appearance.fillMode);
}

function strokeTriggerLabel(appearance: NodeAppearance | SelectionAppearanceSummary): string {
  if (appearance.strokePattern === "mixed" || appearance.strokeColor === "mixed") {
    return "混合";
  }
  return strokePatternLabel(appearance.strokePattern);
}

function stopEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function SquareIcon() {
  return (
    <svg viewBox="0 0 20 20" className="style-popover__inline-icon" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TransparentIcon() {
  return (
    <svg viewBox="0 0 20 20" className="style-popover__inline-icon" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 14.5 14.5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}

function NoFillIcon() {
  return (
    <svg viewBox="0 0 20 20" className="style-popover__inline-icon" aria-hidden="true">
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.3 14.7 14.7 5.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SolidStrokeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="style-popover__inline-icon" aria-hidden="true">
      <path d="M4 14 16 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DashedStrokeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="style-popover__inline-icon" aria-hidden="true">
      <path
        d="M4 14 16 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="3 2"
      />
    </svg>
  );
}
