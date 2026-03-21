import type { EditorMessage } from "../app/types";

interface ToastProps {
  message: EditorMessage;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast toast--${message.tone}${visible ? " is-visible" : ""}`} role="status" aria-live="polite">
      {message.text}
    </div>
  );
}
