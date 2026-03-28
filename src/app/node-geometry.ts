import type { DiagramNode, DiagramNodeType } from "./types";

export const TERMINATOR_NODE_SIZE = { width: 130, height: 66 } as const;
export const START_NODE_SIZE = TERMINATOR_NODE_SIZE;
export const PROCESS_NODE_SIZE = { width: 148, height: 72 } as const;
export const DECISION_NODE_SIZE = { width: 132, height: 132 } as const;
export const QUICK_CONNECT_BUTTON_SIZE = 36;
export const QUICK_CONNECT_BUTTON_OFFSET = 18;

export function getDefaultNodeSize(type: DiagramNodeType): { width: number; height: number } {
  if (type === "decision") {
    return { ...DECISION_NODE_SIZE };
  }
  if (type === "start") {
    return { ...START_NODE_SIZE };
  }
  if (type === "terminator") {
    return { ...TERMINATOR_NODE_SIZE };
  }
  return { ...PROCESS_NODE_SIZE };
}

export function getNodeSize(node: Pick<DiagramNode, "type" | "width" | "height">): { width: number; height: number } {
  const fallback = getDefaultNodeSize(node.type);
  return {
    width: node.width ?? fallback.width,
    height: node.height ?? fallback.height,
  };
}

export function getNodeInteractionOutset(): number {
  return QUICK_CONNECT_BUTTON_SIZE + QUICK_CONNECT_BUTTON_OFFSET;
}

export function getDecisionInnerSquareSize(
  node: Pick<DiagramNode, "type" | "width" | "height">,
): number {
  const size = getNodeSize(node);
  return Math.min(size.width, size.height) / Math.SQRT2;
}
