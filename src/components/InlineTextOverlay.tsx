import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { InlineEditSession } from "../app/types";

export interface InlineOverlayRect {
  targetType: "node" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InlineArmedTarget {
  targetType: "node";
  targetId: string;
  label: string;
  rect: InlineOverlayRect;
}

interface InlineTextOverlayProps {
  session?: InlineEditSession;
  targetRect?: InlineOverlayRect | null;
  armedTarget?: InlineArmedTarget | null;
  onBeginTypeRename: (target: InlineArmedTarget) => void;
  onCommit: (session: InlineEditSession, value: string) => void;
  onCancel: () => void;
}

export function InlineTextOverlay({
  session,
  targetRect,
  armedTarget,
  onBeginTypeRename,
  onCommit,
  onCancel,
}: InlineTextOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef("");
  const composingRef = useRef(false);
  const pendingBlurCommitRef = useRef(false);
  const stagedDraftRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");

  const mode = session ? "editing" : armedTarget ? "armed" : "idle";

  useEffect(() => {
    if (mode === "idle") {
      lastSessionIdRef.current = null;
      stagedDraftRef.current = null;
      composingRef.current = false;
      pendingBlurCommitRef.current = false;
      setDraft("");
      return;
    }

    queueMicrotask(() => {
      if (!inputRef.current) {
        return;
      }
      if (document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
      if (session && session.replaceMode !== "replaceAll") {
        inputRef.current.select();
      } else if (session) {
        const nextLength = draftRef.current.length;
        inputRef.current.setSelectionRange(nextLength, nextLength);
      }
    });
  }, [mode, session]);

  useEffect(() => {
    if (!session) {
      if (armedTarget) {
        draftRef.current = "";
        setDraft("");
      }
      return;
    }

    if (lastSessionIdRef.current === session.sessionId) {
      return;
    }

    lastSessionIdRef.current = session.sessionId;
    const nextDraft =
      stagedDraftRef.current ??
      session.initialValue;

    draftRef.current = nextDraft;
    setDraft(nextDraft);
    stagedDraftRef.current = null;
  }, [armedTarget, session]);

  const style = useMemo(() => buildOverlayStyle(mode, targetRect ?? armedTarget?.rect ?? null), [armedTarget, mode, targetRect]);

  const commit = () => {
    if (!session) {
      return;
    }
    onCommit(session, draftRef.current);
  };

  const beginTypeRenameFromKey = (value: string) => {
    if (!armedTarget || session) {
      return;
    }
    stagedDraftRef.current = value;
    draftRef.current = value;
    setDraft(value);
    onBeginTypeRename(armedTarget);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!session && armedTarget) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Escape") {
        return;
      }
      if (event.key.length === 1 && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        beginTypeRenameFromKey(event.key);
      }
      return;
    }

    event.stopPropagation();
    if (event.nativeEvent.isComposing || composingRef.current) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  const visible = mode !== "idle";

  return (
    <input
      ref={inputRef}
      className={`inline-text-overlay inline-text-overlay--${mode}`}
      style={style}
      value={draft}
      data-inline-proxy-mode={mode}
      aria-hidden={mode === "armed"}
      onChange={(event) => {
        draftRef.current = event.target.value;
        setDraft(event.target.value);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        if (!session && armedTarget) {
          onBeginTypeRename(armedTarget);
        }
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        draftRef.current = event.currentTarget.value;
        setDraft(event.currentTarget.value);
        if (pendingBlurCommitRef.current) {
          pendingBlurCommitRef.current = false;
          queueMicrotask(() => commit());
        }
      }}
      onBlur={() => {
        if (!session) {
          return;
        }
        if (composingRef.current) {
          pendingBlurCommitRef.current = true;
          return;
        }
        commit();
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      spellCheck={false}
      tabIndex={visible ? 0 : -1}
    />
  );
}

function buildOverlayStyle(
  mode: "idle" | "armed" | "editing",
  rect: InlineOverlayRect | null,
): CSSProperties {
  if (mode === "armed" || !rect) {
    return {
      position: "absolute",
      left: -9999,
      top: -9999,
      width: 1,
      height: 1,
      opacity: 0,
      pointerEvents: "none",
    };
  }

  if (rect.targetType === "group") {
    return {
      left: rect.x + 10,
      top: rect.y + 8,
      width: Math.max(120, rect.width - 84),
      height: 32,
    };
  }

  return {
    left: rect.x + 6,
    top: rect.y + rect.height / 2,
    width: Math.max(96, rect.width - 12),
    height: 36,
    transform: "translateY(-50%)",
  };
}
