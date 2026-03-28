import { useMemo } from "react";
import type { DocumentSyncState, EditorDocumentSummary } from "../app/types";

interface DocumentBarProps {
  currentDocumentId?: string;
  title: string;
  syncState: DocumentSyncState;
  lastSavedAt?: string;
  recentDocuments: EditorDocumentSummary[];
  onRename: (title: string) => void;
  onSwitchDocument: (documentId: string) => void;
}

const SAVE_STATE_LABELS: Record<DocumentSyncState, string> = {
  saved: "已保存",
  saving: "保存中",
  dirty: "编辑中",
};

export function DocumentBar({
  currentDocumentId,
  title,
  syncState,
  lastSavedAt,
  recentDocuments,
  onRename,
  onSwitchDocument,
}: DocumentBarProps) {
  const saveHint = useMemo(() => formatSavedAt(lastSavedAt), [lastSavedAt]);

  return (
    <section className="document-panel" aria-label="文档">
      <div className="document-panel__section">
        <div className="document-panel__heading">文档</div>
        <div className="document-panel__identity">
          <input
            className="document-panel__title"
            aria-label="文档标题"
            value={title}
            onChange={(event) => onRename(event.target.value)}
          />
          <div className="document-panel__meta">
            <span className={`document-panel__sync document-panel__sync--${syncState}`}>{SAVE_STATE_LABELS[syncState]}</span>
            <span className="document-panel__saved-at">{saveHint}</span>
          </div>
        </div>
      </div>

      <div className="document-panel__section">
        <label className="document-panel__field">
          <span className="document-panel__field-label">最近文档</span>
          <select
            aria-label="最近文档"
            className="document-panel__select"
            value={currentDocumentId ?? ""}
            onChange={(event) => onSwitchDocument(event.target.value)}
          >
            {recentDocuments.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function formatSavedAt(lastSavedAt?: string): string {
  if (!lastSavedAt) {
    return "未保存";
  }

  const date = new Date(lastSavedAt);
  if (Number.isNaN(date.getTime())) {
    return "已保存";
  }

  return `上次保存 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}
