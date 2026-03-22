import type { DiagramNodeType } from "./types";
import { DECISION_NODE_SIZE, PROCESS_NODE_SIZE, START_NODE_SIZE } from "./node-geometry";

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
    defaultSize: START_NODE_SIZE,
  },
  {
    id: "process",
    label: "步骤",
    icon: "process",
    kind: "node",
    quickCreateEnabled: true,
    toolbarVisible: true,
    createNodeType: "process",
    defaultSize: PROCESS_NODE_SIZE,
  },
  {
    id: "decision",
    label: "判断",
    icon: "decision",
    kind: "node",
    quickCreateEnabled: true,
    toolbarVisible: true,
    createNodeType: "decision",
    defaultSize: DECISION_NODE_SIZE,
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
