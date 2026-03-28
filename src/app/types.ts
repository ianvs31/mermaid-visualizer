export type Direction = "LR" | "RL" | "TB" | "BT" | "TD";
export type ToolMode = "select" | "pan";
export type UiPreset = "figjam" | "classic";
export type EdgeHandlePosition = "left" | "right" | "top" | "bottom";
export type QuickConnectDirection = EdgeHandlePosition;
export type FillMode = "solid" | "transparent" | "none";
export type StrokePattern = "solid" | "dashed";

export type DiagramNodeType =
  | "start"
  | "terminator"
  | "process"
  | "decision"
  | "custom";

export type GroupType = "subgraph" | "swimlane";

export interface NodeAppearance {
  fillMode: FillMode;
  fillColor: string;
  strokeColor: string;
  strokePattern: StrokePattern;
  strokeWidth: number;
  cornerRadius: number;
}

export interface InlineEditSession {
  targetType: "node" | "group";
  targetId: string;
  initialValue: string;
  sessionId: string;
  source: "double-click" | "type-to-rename";
  replaceMode?: "replaceAll" | "preserve";
}

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentGroupId?: string;
  classNames?: string[];
  style?: Record<string, string>;
  appearance?: NodeAppearance;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  strokePattern: StrokePattern;
  sourceHandle?: EdgeHandlePosition;
  targetHandle?: EdgeHandlePosition;
  classNames?: string[];
  style?: Record<string, string>;
}

export interface DiagramGroup {
  id: string;
  type: GroupType;
  title: string;
  direction?: Direction;
  parentGroupId?: string;
  childNodeIds: string[];
  childGroupIds: string[];
  laneMeta?: { orientation: "horizontal" | "vertical"; order: number };
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed?: boolean;
}

export interface DiagramModel {
  direction: Direction;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
  rawPassthroughStatements: string[];
  version: 2;
}

export interface ParseResult {
  model: DiagramModel;
  warnings: string[];
  errors: string[];
}

export interface LayoutOptions {
  direction?: Direction;
  layerSpacing?: number;
  nodeSpacing?: number;
  fitInsideGroups?: boolean;
}

export interface EditorMessage {
  tone: "info" | "success" | "error";
  text: string;
}

export type DocumentSyncState = "saved" | "dirty" | "saving";

export interface EditorDocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface StoredEditorDocumentV1 extends EditorDocumentSummary {
  version: 1;
  code: string;
  codeDirty: boolean;
  model: DiagramModel;
}

export interface InteractionState {
  uiPreset: UiPreset;
  toolMode: ToolMode;
  snapToGrid: boolean;
  snapGrid: [number, number];
  showHandlesOnHover: boolean;
  showAlignmentGuides: boolean;
  viewportHudVisible: boolean;
}

export const DEFAULT_DIRECTION: Direction = "LR";

export function createEmptyModel(): DiagramModel {
  return {
    direction: DEFAULT_DIRECTION,
    nodes: [],
    edges: [],
    groups: [],
    rawPassthroughStatements: [],
    version: 2,
  };
}
