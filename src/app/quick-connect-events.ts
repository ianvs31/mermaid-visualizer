import type { QuickConnectDirection } from "./types";

export const QUICK_CONNECT_EVENT = "mermaid-visualizer:quick-connect";

export interface QuickConnectEventDetail {
  nodeId: string;
  direction: QuickConnectDirection;
  anchorClientX: number;
  anchorClientY: number;
}

export function dispatchQuickConnectEvent(detail: QuickConnectEventDetail): void {
  window.dispatchEvent(new CustomEvent<QuickConnectEventDetail>(QUICK_CONNECT_EVENT, { detail }));
}
