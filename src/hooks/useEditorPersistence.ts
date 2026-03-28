import { useEffect, useRef } from "react";
import type { DocumentSyncState, DiagramModel } from "../app/types";

export function useEditorPersistence(
  snapshot: {
    currentDocumentId?: string;
    title: string;
    code: string;
    model: DiagramModel;
    codeDirty: boolean;
    documentSyncState: DocumentSyncState;
  },
  enabled: boolean,
  saveCurrentDocument: () => void,
) {
  const didMountRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (!enabled) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!snapshot.currentDocumentId || snapshot.documentSyncState !== "dirty") {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      saveCurrentDocument();
      timerRef.current = null;
    }, 220);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, saveCurrentDocument, snapshot]);
}
