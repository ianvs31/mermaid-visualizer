import { useEffect, useRef } from "react";
import { saveDraftSnapshot } from "../app/persistence";
import type { DiagramModel } from "../app/types";

export function useEditorPersistence(snapshot: { code: string; model: DiagramModel; codeDirty: boolean }) {
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    saveDraftSnapshot(snapshot);
  }, [snapshot]);
}
