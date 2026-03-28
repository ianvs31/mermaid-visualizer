import { loadDraftSnapshot } from "./persistence";
import type { DiagramModel, EditorDocumentSummary, StoredEditorDocumentV1 } from "./types";

const DOCUMENT_INDEX_KEY = "mv:documents:index";
const DOCUMENT_KEY_PREFIX = "mv:document:";
const WORKSPACE_KEY = "mv:workspace";

interface DocumentIndexV1 {
  version: 1;
  documents: EditorDocumentSummary[];
}

interface DocumentWorkspaceStateV1 {
  version: 1;
  lastOpenedDocumentId?: string;
}

export function listStoredDocuments(): EditorDocumentSummary[] {
  const index = loadDocumentIndex();
  if (!index) {
    return [];
  }

  return [...index.documents].sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
}

export function loadStoredDocument(documentId: string): StoredEditorDocumentV1 | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(documentStorageKey(documentId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredEditorDocumentV1 | null;
    return isStoredEditorDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredDocument(document: StoredEditorDocumentV1): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(documentStorageKey(document.id), JSON.stringify(document));

  const index = loadDocumentIndex();
  const nextSummary = toSummary(document);
  const documents = index?.documents ?? [];
  const nextDocuments = documents.some((item) => item.id === document.id)
    ? documents.map((item) => (item.id === document.id ? nextSummary : item))
    : [...documents, nextSummary];

  saveDocumentIndex({ version: 1, documents: nextDocuments });
}

export function loadWorkspaceState(): DocumentWorkspaceStateV1 | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(WORKSPACE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DocumentWorkspaceStateV1 | null;
    return isWorkspaceState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceState(state: DocumentWorkspaceStateV1): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
}

export function migrateLegacyDraftToStoredDocument(title: string): StoredEditorDocumentV1 | null {
  const draft = loadDraftSnapshot();
  if (!draft) {
    return null;
  }

  const now = draft.savedAt;
  const document: StoredEditorDocumentV1 = {
    version: 1,
    id: createDocumentId(),
    title,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    code: draft.code,
    codeDirty: draft.codeDirty,
    model: draft.model,
  };

  saveStoredDocument(document);
  saveWorkspaceState({ version: 1, lastOpenedDocumentId: document.id });
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("mv:draft");
  }
  return document;
}

function documentStorageKey(documentId: string): string {
  return `${DOCUMENT_KEY_PREFIX}${documentId}`;
}

function saveDocumentIndex(index: DocumentIndexV1): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(DOCUMENT_INDEX_KEY, JSON.stringify(index));
}

function loadDocumentIndex(): DocumentIndexV1 | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(DOCUMENT_INDEX_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DocumentIndexV1 | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.documents) || !parsed.documents.every(isSummary)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function createDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSummary(document: StoredEditorDocumentV1): EditorDocumentSummary {
  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastOpenedAt: document.lastOpenedAt,
  };
}

function isSummary(value: unknown): value is EditorDocumentSummary {
  return (
    isPlainRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.lastOpenedAt === "string"
  );
}

function isWorkspaceState(value: unknown): value is DocumentWorkspaceStateV1 {
  return (
    isPlainRecord(value) &&
    value.version === 1 &&
    (value.lastOpenedDocumentId === undefined || typeof value.lastOpenedDocumentId === "string")
  );
}

function isStoredEditorDocument(value: unknown): value is StoredEditorDocumentV1 {
  return (
    isPlainRecord(value) &&
    value.version === 1 &&
    isSummary(value) &&
    typeof value.code === "string" &&
    typeof value.codeDirty === "boolean" &&
    isDiagramModel(value.model)
  );
}

function isDiagramModel(value: unknown): value is DiagramModel {
  return (
    isPlainRecord(value) &&
    value.version === 2 &&
    typeof value.direction === "string" &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    Array.isArray(value.groups) &&
    Array.isArray(value.rawPassthroughStatements)
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
