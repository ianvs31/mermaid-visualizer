import { useEffect, useState } from "react";

const PREVIEW_RENDER_DELAY_MS = 260;

let mermaidPromise: Promise<(typeof import("mermaid"))["default"]> | null = null;
let mermaidInitialized = false;

async function loadMermaid() {
  mermaidPromise ??= import("mermaid").then((module) => {
    const instance = module.default;
    if (!mermaidInitialized) {
      instance.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
      mermaidInitialized = true;
    }
    return instance;
  });

  return mermaidPromise;
}

export function useMermaidPreview(code: string, renderTick: number) {
  const [previewSvg, setPreviewSvg] = useState("");
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const trimmed = code.trim();

    if (!trimmed) {
      setPreviewSvg("");
      setPreviewError("");
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const mermaid = await loadMermaid();
          const { svg } = await mermaid.render(`preview-${Date.now()}`, trimmed);

          if (!cancelled) {
            setPreviewSvg(svg);
            setPreviewError("");
          }
        } catch (error) {
          if (!cancelled) {
            setPreviewSvg("");
            setPreviewError(String(error));
          }
        }
      })();
    }, PREVIEW_RENDER_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, renderTick]);

  return { previewSvg, previewError };
}
