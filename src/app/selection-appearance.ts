import { resolveNodeAppearance } from "./appearance";
import type { DiagramNode, FillMode, NodeAppearance, StrokePattern } from "./types";

export type MixedValue = "mixed";

export interface SelectionAppearanceSummary {
  fillMode: FillMode | MixedValue;
  fillColor: string | MixedValue;
  strokeColor: string | MixedValue;
  strokePattern: StrokePattern | MixedValue;
  strokeWidth: number | MixedValue;
}

export function summarizeNodeAppearances(nodes: DiagramNode[]): SelectionAppearanceSummary | null {
  if (nodes.length === 0) {
    return null;
  }

  const appearances = nodes.map((node) => resolveNodeAppearance(node));

  return {
    fillMode: summarizeValue(appearances, (appearance) => appearance.fillMode),
    fillColor: summarizeValue(appearances, (appearance) => appearance.fillColor),
    strokeColor: summarizeValue(appearances, (appearance) => appearance.strokeColor),
    strokePattern: summarizeValue(appearances, (appearance) => appearance.strokePattern),
    strokeWidth: summarizeValue(appearances, (appearance) => appearance.strokeWidth),
  };
}

function summarizeValue<T extends string | number>(
  appearances: NodeAppearance[],
  pick: (appearance: NodeAppearance) => T,
): T | MixedValue {
  const first = pick(appearances[0]);
  return appearances.every((appearance) => pick(appearance) === first) ? first : "mixed";
}
