import type { ToolMode } from "./types";

export const TOOL_SHORTCUTS: Record<ToolMode, string> = {
  select: "v",
  pan: "h",
};

export function isInputLike(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }

  if (element.tagName === "INPUT" && element.dataset.inlineProxyMode === "armed") {
    return false;
  }

  return element.tagName === "TEXTAREA" || element.tagName === "INPUT" || element.isContentEditable;
}

export function isArmedInlineProxyTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && element.tagName === "INPUT" && element.dataset.inlineProxyMode === "armed";
}

export function isResetViewportShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key === "0";
}

export function isApplyCodeShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key === "Enter";
}

export function isUndoShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
}

export function isRedoShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z";
}

export function isCopyShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
}

export function isCutShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x";
}

export function isPasteShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
}

export function isFitViewShortcut(event: KeyboardEvent): boolean {
  return event.shiftKey && event.key === "1";
}

export function isCenterViewportShortcut(event: KeyboardEvent): boolean {
  return event.shiftKey && event.key === "2";
}

export function pickToolModeFromShortcut(event: KeyboardEvent): ToolMode | null {
  const key = event.key.toLowerCase();
  if (key === TOOL_SHORTCUTS.select) {
    return "select";
  }
  if (key === TOOL_SHORTCUTS.pan) {
    return "pan";
  }
  return null;
}
