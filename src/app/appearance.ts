import type { DiagramNode, FillMode, NodeAppearance, StrokePattern } from "./types";

export const APPEARANCE_SWATCHES = [
  "#1f1f22",
  "#8c8c8c",
  "#eb5c33",
  "#f2a651",
  "#f2ca5c",
  "#84d17a",
  "#7ad0cb",
  "#5fa1ef",
  "#7b57ea",
  "#db57b8",
  "#ffffff",
  "#c7c7c7",
  "#e7e7e7",
  "#f2cbc5",
  "#f4e2ca",
  "#f5eabc",
  "#cae8c8",
  "#c9eaea",
  "#cae0f6",
  "#d8cef3",
  "#ecc8e7",
] as const;

export const DEFAULT_NODE_APPEARANCE: NodeAppearance = {
  fillMode: "solid",
  fillColor: "#ffffff",
  strokeColor: "#344054",
  strokePattern: "solid",
  strokeWidth: 2,
  cornerRadius: 10,
};

const PAINT_STYLE_KEYS = new Set([
  "fill",
  "background",
  "background-color",
  "fill-opacity",
  "stroke",
  "border",
  "border-color",
  "stroke-width",
  "strokeDasharray",
  "stroke-dasharray",
  "border-style",
  "border-width",
  "color",
  "border-radius",
  "borderRadius",
  "corner-radius",
]);

export interface DerivedNodePaint {
  fill: string;
  stroke: string;
  color: string;
  strokeWidth: number;
  strokeDasharray?: string;
  borderRadius: number;
}

export function resolveNodeAppearance(node: Pick<DiagramNode, "appearance" | "style">): NodeAppearance {
  return normalizeNodeAppearance(node.appearance ?? inferAppearanceFromStyle(node.style) ?? DEFAULT_NODE_APPEARANCE);
}

export function normalizeNodeAppearance(
  appearance: Partial<NodeAppearance> & { baseColor?: string },
): NodeAppearance {
  const fallbackColor =
    normalizeHex(appearance.fillColor) ??
    normalizeHex(appearance.baseColor) ??
    DEFAULT_NODE_APPEARANCE.fillColor;
  const fallbackStroke =
    normalizeHex(appearance.strokeColor) ??
    normalizeHex(appearance.baseColor) ??
    DEFAULT_NODE_APPEARANCE.strokeColor;

  return {
    fillMode: normalizeFillMode(appearance.fillMode),
    fillColor: fallbackColor,
    strokeColor: fallbackStroke,
    strokePattern: normalizeStrokePattern(appearance.strokePattern),
    strokeWidth: Number.isFinite(appearance.strokeWidth)
      ? Math.max(1, Number(appearance.strokeWidth))
      : DEFAULT_NODE_APPEARANCE.strokeWidth,
    cornerRadius: Number.isFinite(appearance.cornerRadius)
      ? Math.max(0, Number(appearance.cornerRadius))
      : DEFAULT_NODE_APPEARANCE.cornerRadius,
  };
}

export function deriveNodePaint(appearance: NodeAppearance): DerivedNodePaint {
  const normalized = normalizeNodeAppearance(appearance);
  const actualFillColor = normalizeHex(normalized.fillColor) ?? DEFAULT_NODE_APPEARANCE.fillColor;
  const actualStrokeColor = normalizeHex(normalized.strokeColor) ?? DEFAULT_NODE_APPEARANCE.strokeColor;

  let fill = actualFillColor;
  if (normalized.fillMode === "transparent") {
    fill = withAlpha(actualFillColor, 0.18);
  }
  if (normalized.fillMode === "none") {
    fill = "transparent";
  }

  let color = autoContrast(fill);
  if (normalized.fillMode === "transparent") {
    color = readableDark(actualFillColor);
  }
  if (normalized.fillMode === "none") {
    color = readableDark(actualStrokeColor);
  }

  return {
    fill,
    stroke: actualStrokeColor,
    color,
    strokeWidth: normalized.strokeWidth,
    strokeDasharray: normalized.strokePattern === "dashed" ? "6 4" : undefined,
    borderRadius: normalized.cornerRadius,
  };
}

export function buildStyleFromAppearance(appearance: NodeAppearance): Record<string, string> {
  const normalized = normalizeNodeAppearance(appearance);
  const paint = deriveNodePaint(normalized);
  const fillValue =
    normalized.fillMode === "transparent"
      ? normalized.fillColor
      : normalized.fillMode === "none"
        ? "transparent"
        : paint.fill;
  return {
    fill: fillValue,
    stroke: paint.stroke,
    color: paint.color,
    "stroke-width": `${paint.strokeWidth}px`,
    ...(normalized.fillMode === "transparent" ? { "fill-opacity": "0.18" } : {}),
    ...(paint.strokeDasharray ? { "stroke-dasharray": paint.strokeDasharray } : {}),
    "border-radius": `${paint.borderRadius}px`,
  };
}

export function stripPaintStyle(style: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!style) {
    return undefined;
  }

  const next = Object.fromEntries(Object.entries(style).filter(([key]) => !PAINT_STYLE_KEYS.has(key)));
  return Object.keys(next).length ? next : undefined;
}

export function inferAppearanceFromStyle(style: Record<string, string> | undefined): NodeAppearance | undefined {
  if (!style || Object.keys(style).length === 0) {
    return undefined;
  }

  const fillRaw = String(style.fill || style.background || style["background-color"] || "").trim();
  const strokeRaw = String(style.stroke || style.border || style["border-color"] || "").trim();
  const fillColor = normalizeAnyColor(fillRaw) ?? normalizeAnyColor(strokeRaw) ?? DEFAULT_NODE_APPEARANCE.fillColor;
  const strokeColor = normalizeAnyColor(strokeRaw) ?? normalizeAnyColor(fillRaw) ?? DEFAULT_NODE_APPEARANCE.strokeColor;

  const lowerFill = fillRaw.toLowerCase();
  const fillMode: FillMode =
    lowerFill === "transparent" || lowerFill === "none"
      ? "none"
      : lowerFill.startsWith("rgba(") || lowerFill.startsWith("hsla(") || style["fill-opacity"] === "0.18"
        ? "transparent"
        : "solid";

  const strokeDash = String(style["stroke-dasharray"] || style.strokeDasharray || style["border-style"] || "solid")
    .trim()
    .toLowerCase();
  const strokePattern: StrokePattern = strokeDash.includes("6 4") || strokeDash === "dashed" ? "dashed" : "solid";

  return normalizeNodeAppearance({
    fillMode,
    fillColor,
    strokeColor,
    strokePattern,
    strokeWidth: parseCssNumber(style["stroke-width"] || style.strokeWidth || style["border-width"], 2),
    cornerRadius: parseCssNumber(style["border-radius"] || style.borderRadius || style["corner-radius"], 10),
  });
}

export function normalizeHex(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith("#")) {
    return undefined;
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  if (trimmed.length === 7) {
    return trimmed;
  }

  return undefined;
}

export function darken(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex) ?? { r: 52, g: 64, b: 84 };
  return rgbToHex({
    r: Math.round(rgb.r * (1 - ratio)),
    g: Math.round(rgb.g * (1 - ratio)),
    b: Math.round(rgb.b * (1 - ratio)),
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 95, g: 161, b: 239 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function autoContrast(fill: string): string {
  if (fill === "transparent") {
    return "#111827";
  }

  const rgb = parseColor(fill);
  if (!rgb) {
    return "#111827";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.72 ? "#111827" : "#ffffff";
}

export function normalizeAnyColor(value: string | undefined | null): string | undefined {
  const normalizedHex = normalizeHex(value);
  if (normalizedHex) {
    return normalizedHex;
  }

  const rgb = parseColor(value || "");
  return rgb ? rgbToHex(rgb) : undefined;
}

function normalizeFillMode(mode: FillMode | undefined): FillMode {
  if (mode === "transparent" || mode === "none") {
    return mode;
  }
  return "solid";
}

function normalizeStrokePattern(pattern: StrokePattern | undefined): StrokePattern {
  return pattern === "dashed" ? "dashed" : "solid";
}

function readableDark(color: string): string {
  const normalized = normalizeAnyColor(color) ?? DEFAULT_NODE_APPEARANCE.strokeColor;
  if (isNearWhite(normalized)) {
    return "#111827";
  }
  return darken(normalized, 0.4);
}

function isNearWhite(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return false;
  }
  return rgb.r > 246 && rgb.g > 246 && rgb.b > 246;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return undefined;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

function parseColor(value: string): { r: number; g: number; b: number } | undefined {
  const normalizedHex = normalizeHex(value);
  if (normalizedHex) {
    return hexToRgb(normalizedHex);
  }

  const rgba = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
    };
  }

  return undefined;
}

function parseCssNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(String(value).replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
