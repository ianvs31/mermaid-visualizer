import type { DiagramNodeType } from "./types";

export type PaletteItemId = "rounded" | "process" | "decision" | "swimlane";

export type ToolbarIconName =
  | "select"
  | "pan"
  | "rounded"
  | "process"
  | "decision"
  | "swimlane"
  | "layout";

export interface PaletteItemDefinition {
  id: PaletteItemId;
  label: string;
  icon: ToolbarIconName;
  kind: "node" | "group";
  quickCreateEnabled: boolean;
  toolbarVisible: boolean;
  createNodeType?: DiagramNodeType;
  defaultSize: { width: number; height: number };
}

export const PALETTE_ITEMS: PaletteItemDefinition[] = [
  {
    id: "rounded",
    label: "起止",
    icon: "rounded",
    kind: "node",
    quickCreateEnabled: true,
    toolbarVisible: true,
    createNodeType: "start",
    defaultSize: { width: 130, height: 66 },
  },
  {
    id: "process",
    label: "步骤",
    icon: "process",
    kind: "node",
    quickCreateEnabled: true,
    toolbarVisible: true,
    createNodeType: "process",
    defaultSize: { width: 148, height: 72 },
  },
  {
    id: "decision",
    label: "判断",
    icon: "decision",
    kind: "node",
    quickCreateEnabled: true,
    toolbarVisible: true,
    createNodeType: "decision",
    defaultSize: { width: 132, height: 132 },
  },
  {
    id: "swimlane",
    label: "泳道",
    icon: "swimlane",
    kind: "group",
    quickCreateEnabled: false,
    toolbarVisible: true,
    defaultSize: { width: 620, height: 220 },
  },
];

export const QUICK_CREATE_ITEMS = PALETTE_ITEMS.filter((item) => item.quickCreateEnabled);

export function getPaletteItem(itemId: PaletteItemId): PaletteItemDefinition {
  const item = PALETTE_ITEMS.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Unknown palette item: ${itemId}`);
  }
  return item;
}

