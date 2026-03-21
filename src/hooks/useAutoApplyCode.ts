import { useEffect } from "react";

const AUTO_APPLY_DELAY_MS = 260;

export function useAutoApplyCode(
  code: string,
  codeDirty: boolean,
  applyCodeToModel: (options?: { fitView?: boolean; quiet?: boolean }) => Promise<void>,
): void {
  useEffect(() => {
    if (!codeDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void applyCodeToModel({ quiet: true });
    }, AUTO_APPLY_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [applyCodeToModel, codeDirty, code]);
}
