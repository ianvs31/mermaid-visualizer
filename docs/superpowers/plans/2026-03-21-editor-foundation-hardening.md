# Editor Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a more production-ready v2 editor by adding draft persistence, a real browser file workflow, refreshed end-to-end regression coverage, lighter preview/layout execution, and UI access to a few model capabilities that already exist in the store.

**Architecture:** Keep `DiagramModel` in Zustand as the single source of truth, but move persistence, preview scheduling, and browser file operations behind focused modules so `src/App.tsx` stops coordinating everything directly. Treat performance work as targeted decomposition rather than a rewrite: preserve current data structures, add lazy loading and debounced/cancelable work, and only expose functionality already supported by the model unless a task explicitly adds new behavior.

**Tech Stack:** React 19, TypeScript, Vite, React Flow, Zustand, Mermaid, ELK, Vitest, Testing Library, Playwright

---

## Scope And Release Boundary

This plan intentionally covers one release-sized milestone instead of the full long-term roadmap. It includes:

- draft persistence and recovery
- browser open/save/download workflow
- exposing collapse and selection-to-group in the UI
- performance hardening around preview, code-apply, bundle size, and oversized files
- Playwright coverage and CI entry points

It does not include:

- real-time collaboration
- backend sync
- non-flowchart Mermaid diagram families
- deep draw.io style-fidelity work

## File Structure

### New Files

- `src/app/persistence.ts`
  Versioned local draft snapshot read/write helpers plus migration-safe guards.
- `src/app/persistence.test.ts`
  Unit tests for snapshot versioning, restore validation, and corrupted storage handling.
- `src/app/file-io.ts`
  Browser helpers for download/open behavior using `Blob`, hidden file inputs, and feature detection.
- `src/app/file-io.test.ts`
  Unit tests for extension mapping and fallback behavior.
- `src/hooks/useEditorPersistence.ts`
  React hook that subscribes to editor state changes and restores drafts on boot without polluting `App.tsx`.
- `src/hooks/useMermaidPreview.ts`
  Debounced, cancel-safe preview rendering hook with lazy Mermaid loading.
- `src/hooks/useAutoApplyCode.ts`
  Centralizes delayed parse/apply behavior now embedded in `src/App.tsx`.
- `src/components/FileActionsPopover.tsx`
  Focused file workflow UI if the existing help/export popover becomes too crowded.
- `playwright.config.ts`
  Stable Playwright configuration for local and CI runs.
- `e2e/editor-smoke.spec.ts`
  Happy-path visual editing regression aligned to the current FigJam-style toolbar.
- `e2e/persistence.spec.ts`
  Draft persistence restore test.
- `e2e/file-workflow.spec.ts`
  Browser open/export/download regression.
- `.github/workflows/ci.yml`
  Run build, unit tests, and Playwright in CI.

### Modified Files

- `src/App.tsx`
  Remove direct persistence/preview scheduling concerns, wire new UI affordances, and shrink the main orchestration file.
- `src/app/store.ts`
  Add restore-safe initialization, explicit “new/open/save” actions, and selectors/hooks support without changing `DiagramModel` ownership.
- `src/app/export.ts`
  Reuse export text generation for downloads in addition to clipboard copy.
- `src/app/import-drawio.ts`
  Keep as-is unless open-file flow needs lighter adapter signatures.
- `src/components/ViewportControls.tsx`
  Add entry points for file actions and keep viewport-only controls focused.
- `src/components/HelpExportPopover.tsx`
  Either slim down to help/import/export only, or delegate file actions to `FileActionsPopover`.
- `src/components/nodes.tsx`
  Add group collapse affordance if the group header owns that interaction.
- `src/app/reactflow-mapper.ts`
  Propagate collapse UI state cleanly to group nodes.
- `src/App.test.tsx`
  Extend app-level tests for persistence restore, file actions, and group actions.
- `src/app/store.test.ts`
  Cover restore/init/new/open/save-related store behavior.
- `package.json`
  Add `test:e2e` and `test:e2e:headed` scripts.
- `README.md`
  Document file workflow, persistence, and the now-official e2e path.

### Existing Hotspots To Split Gradually

- `src/App.tsx` is currently about 1911 lines.
- `src/app/store.ts` is currently about 1385 lines.
- `src/styles/app.css` is currently about 1453 lines.

Do not attempt a full rewrite. Split only the concerns this milestone touches.

## Task 1: Draft Persistence And Safe Boot Flow

**Files:**
- Create: `src/app/persistence.ts`
- Create: `src/app/persistence.test.ts`
- Create: `src/hooks/useEditorPersistence.ts`
- Modify: `src/app/store.ts`
- Modify: `src/App.tsx`
- Test: `src/app/persistence.test.ts`
- Test: `src/app/store.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing persistence helper tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { loadDraftSnapshot, saveDraftSnapshot } from "./persistence";

describe("draft persistence", () => {
  it("restores a valid versioned draft", () => {
    localStorage.setItem("mv:draft", JSON.stringify({
      version: 1,
      savedAt: "2026-03-21T10:00:00.000Z",
      code: "flowchart LR\nA-->B",
      model: { version: 2, direction: "LR", nodes: [], edges: [], groups: [], rawPassthroughStatements: [] },
    }));

    expect(loadDraftSnapshot()?.code).toContain("flowchart LR");
  });

  it("returns null for malformed payloads", () => {
    localStorage.setItem("mv:draft", "{broken");
    expect(loadDraftSnapshot()).toBeNull();
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run: `npm run test -- src/app/persistence.test.ts`
Expected: FAIL because `src/app/persistence.ts` does not exist yet.

- [ ] **Step 3: Implement versioned persistence helpers**

```ts
const STORAGE_KEY = "mv:draft";

export interface DraftSnapshotV1 {
  version: 1;
  savedAt: string;
  code: string;
  model: DiagramModel;
}

export function loadDraftSnapshot(): DraftSnapshotV1 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run helper tests to verify they pass**

Run: `npm run test -- src/app/persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Add failing store/app restore tests**

```ts
it("prefers restoring a saved draft over loading the sample", () => {
  localStorage.setItem("mv:draft", JSON.stringify({
    version: 1,
    savedAt: "2026-03-21T10:00:00.000Z",
    code: "flowchart LR\nR1-->R2",
    model: restoredModel,
  }));
  useEditorStore.getState().init();
  expect(useEditorStore.getState().code).toContain("R1-->R2");
  expect(useEditorStore.getState().message.text).toContain("恢复");
});
```

- [ ] **Step 6: Run restore-focused tests to verify they fail**

Run: `npm run test -- src/app/store.test.ts src/App.test.tsx`
Expected: FAIL because init still loads the sample every time.

- [ ] **Step 7: Implement restore-aware initialization**

```ts
init: () => {
  const uiPreset = readUiPresetFromUrl();
  get().setUiPreset(uiPreset);
  const restored = loadDraftSnapshot();
  if (restored) {
    get().replaceModel(restored.model, "已恢复本地草稿");
    set({ code: restored.code, codeDirty: false, warnings: [] });
    return;
  }
  get().loadSample();
}
```

- [ ] **Step 8: Persist code/model changes through a hook instead of inline effects**

```ts
export function useEditorPersistence(snapshot: { code: string; model: DiagramModel; codeDirty: boolean }) {
  useEffect(() => {
    saveDraftSnapshot(snapshot);
  }, [snapshot]);
}
```

- [ ] **Step 9: Run persistence-related tests**

Run: `npm run test -- src/app/persistence.test.ts src/app/store.test.ts src/App.test.tsx`
Expected: PASS with new restore coverage green.

- [ ] **Step 10: Commit**

```bash
git add src/app/persistence.ts src/app/persistence.test.ts src/hooks/useEditorPersistence.ts src/app/store.ts src/App.tsx src/app/store.test.ts src/App.test.tsx
git commit -m "feat: add local draft persistence"
```

## Task 2: Browser File Workflow For New/Open/Save/Download

**Files:**
- Create: `src/app/file-io.ts`
- Create: `src/app/file-io.test.ts`
- Modify: `src/app/export.ts`
- Modify: `src/app/store.ts`
- Modify: `src/components/ViewportControls.tsx`
- Modify: `src/components/HelpExportPopover.tsx`
- Create: `src/components/FileActionsPopover.tsx` (only if needed)
- Modify: `src/App.tsx`
- Modify: `package.json`
- Test: `src/app/file-io.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing file-io tests**

```ts
it("maps export formats to stable download filenames", () => {
  expect(defaultFilenameFor("editor-json")).toBe("diagram.mermaid-visualizer.json");
  expect(defaultFilenameFor("markdown-mermaid")).toBe("diagram.md");
});
```

- [ ] **Step 2: Run file-io tests to verify they fail**

Run: `npm run test -- src/app/file-io.test.ts`
Expected: FAIL because helpers do not exist yet.

- [ ] **Step 3: Implement browser file helpers**

```ts
export function downloadTextFile(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run file-io tests to verify they pass**

Run: `npm run test -- src/app/file-io.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing UI tests for file actions**

```ts
it("offers new, open, and download actions from the help/file controls", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "帮助与导出" }));
  expect(screen.getByRole("button", { name: "新建图表" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "打开 Mermaid 文件" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "下载 JSON" })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run app tests to verify they fail**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL because the current popover only supports clipboard export and draw.io import.

- [ ] **Step 7: Add explicit store/app actions**

Implement:

- `newDocument()`
- `openMermaidText(text: string)`
- `downloadExport(format: ExportFormat)`

Use `createEmptyModel()` for “new”, confirm unsaved overwrite with a single guard function, and reuse `buildExportText()` from `src/app/export.ts` for downloads.

- [ ] **Step 8: Wire the UI**

Expose:

- `新建图表`
- `打开 Mermaid 文件`
- `打开 draw.io 文件`
- `下载 Mermaid`
- `下载 JSON`
- `下载 draw.io XML`

Prefer keeping clipboard-copy actions too, because they are already useful and tested.

- [ ] **Step 9: Run the focused test set**

Run: `npm run test -- src/app/file-io.test.ts src/App.test.tsx`
Expected: PASS.

- [ ] **Step 10: Run full unit suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/app/file-io.ts src/app/file-io.test.ts src/app/export.ts src/app/store.ts src/components/ViewportControls.tsx src/components/HelpExportPopover.tsx src/App.tsx src/App.test.tsx package.json
git commit -m "feat: add browser file workflow"
```

## Task 3: Expose Existing Group Capabilities In The UI

**Files:**
- Modify: `src/app/store.ts`
- Modify: `src/app/reactflow-mapper.ts`
- Modify: `src/components/nodes.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/CanvasToolbar.tsx` (only if a toolbar action is added)
- Test: `src/app/store.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing store tests for group actions**

```ts
it("toggles collapse state for a selected group", () => {
  resetStore(createGroupedModel());
  useEditorStore.getState().toggleGroupCollapse("G1");
  expect(useEditorStore.getState().model.groups[0].collapsed).toBe(true);
});
```

- [ ] **Step 2: Run store tests to verify current gaps**

Run: `npm run test -- src/app/store.test.ts`
Expected: PASS for pure store toggling, but no UI coverage yet.

- [ ] **Step 3: Write failing app tests for UI affordances**

```ts
it("collapses a swimlane from the group header control", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "折叠 业务侧" }));
  expect(useEditorStore.getState().model.groups.find((g) => g.id === "G1")?.collapsed).toBe(true);
});
```

Add a second test for “move selected nodes into selected group” if that action gets exposed in a contextual button.

- [ ] **Step 4: Run app tests to verify they fail**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL because no collapse or assign-to-group UI exists today.

- [ ] **Step 5: Implement the smallest UI that matches existing store capabilities**

Suggested UI:

- group header button: collapse/expand
- selection toolbar or help popover action: “移入当前分区”

Do not invent new group semantics. Only expose `toggleGroupCollapse()` and `assignSelectionToGroup()` that already exist.

- [ ] **Step 6: Re-run focused tests**

Run: `npm run test -- src/app/store.test.ts src/App.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/store.ts src/app/reactflow-mapper.ts src/components/nodes.tsx src/App.tsx src/app/store.test.ts src/App.test.tsx
git commit -m "feat: expose group actions in the editor ui"
```

## Task 4: Performance Hardening And Code Decomposition

**Files:**
- Create: `src/hooks/useMermaidPreview.ts`
- Create: `src/hooks/useAutoApplyCode.ts`
- Modify: `src/App.tsx`
- Modify: `src/app/store.ts`
- Modify: `src/app/layout.ts`
- Modify: `vite.config.ts`
- Test: `src/App.test.tsx`
- Test: `src/app/store.test.ts`

- [ ] **Step 1: Write failing tests for preview scheduling behavior**

```ts
it("coalesces rapid code edits before applying to the model", async () => {
  vi.useFakeTimers();
  render(<App />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "flowchart LR\nA-->B" } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "flowchart LR\nA-->C" } });
  vi.advanceTimersByTime(260);
  await waitFor(() => expect(useEditorStore.getState().code).toContain("A-->C"));
});
```

- [ ] **Step 2: Run app tests to confirm the baseline**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS or partial PASS, but no dedicated scheduling hook exists yet.

- [ ] **Step 3: Extract preview and auto-apply out of `src/App.tsx`**

Move:

- Mermaid preview rendering
- delayed `applyCodeToModel({ quiet: true })`
- cleanup/cancellation behavior

into `useMermaidPreview()` and `useAutoApplyCode()`.

- [ ] **Step 4: Lazy-load heavy libraries**

Use dynamic imports for Mermaid preview and ELK layout entry points instead of importing them eagerly at module top-level.

Example target shape:

```ts
let mermaidModulePromise: Promise<typeof import("mermaid")> | null = null;

export function loadMermaid() {
  mermaidModulePromise ??= import("mermaid");
  return mermaidModulePromise;
}
```

Do the same for the ELK loader used by `src/app/layout.ts`.

- [ ] **Step 5: Avoid unnecessary full-history churn**

Audit hot paths in `src/app/store.ts` and stop pushing history or reserializing when there is no semantic change. Focus on:

- repeated geometry updates
- no-op selection/appearance actions
- boot-time restore/init

- [ ] **Step 6: Add build-level chunk guidance**

Update `vite.config.ts` with conservative `manualChunks` for Mermaid- and layout-related code so the warning becomes measurable and intentional rather than accidental.

- [ ] **Step 7: Run focused tests**

Run: `npm run test -- src/App.test.tsx src/app/store.test.ts`
Expected: PASS.

- [ ] **Step 8: Run a production build and record the new baseline**

Run: `npm run build`
Expected: PASS. Compare output to the current baseline where `dist/assets/index-*.js` is about 2.4 MB and triggers chunk warnings.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useMermaidPreview.ts src/hooks/useAutoApplyCode.ts src/App.tsx src/app/store.ts src/app/layout.ts vite.config.ts src/App.test.tsx src/app/store.test.ts
git commit -m "perf: split heavy editor paths and lazy load renderers"
```

## Task 5: Playwright Regression And CI

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json`
- Replace: `e2e/figjam-interaction.spec.ts`
- Create: `e2e/editor-smoke.spec.ts`
- Create: `e2e/persistence.spec.ts`
- Create: `e2e/file-workflow.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Replace outdated e2e assumptions with current UI coverage**

Write failing or fresh specs for:

- toolbar item creation (`起止`, `步骤`, `判断`, `泳道`)
- quick-connect flow
- local draft restore
- file import/export UI

Do not reuse the existing assumption that a dedicated “连线” toolbar button exists.

- [ ] **Step 2: Add package scripts**

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

- [ ] **Step 3: Run the first smoke spec locally**

Run: `npx playwright test e2e/editor-smoke.spec.ts`
Expected: FAIL first, then PASS after selectors and flows are aligned.

- [ ] **Step 4: Implement CI workflow**

Required job order:

1. `npm ci`
2. `npm run test`
3. `npm run build`
4. `npx playwright install --with-deps`
5. `npx playwright test`

- [ ] **Step 5: Document the official regression path**

Update `README.md` with:

- `npm run test:e2e`
- browser requirements
- note that Playwright now covers the main FigJam-style flow

- [ ] **Step 6: Run the full verification suite**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `npx playwright test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts package.json e2e .github/workflows/ci.yml README.md
git commit -m "test: add maintained e2e coverage and ci"
```

## Final Verification Checklist

- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npx playwright test`
- [ ] Manually verify:
  - draft restore after refresh
  - new/open/save/download workflow
  - group collapse/assign interaction
  - no sample overwrite when a draft exists

## Recommended Execution Order

1. Task 1: Draft persistence and safe boot flow
2. Task 2: Browser file workflow
3. Task 3: Expose existing group capabilities in the UI
4. Task 4: Performance hardening and code decomposition
5. Task 5: Playwright regression and CI

This order gives the team a safer editor first, then a usable file workflow, then small UI wins, then performance cleanup, and finally a reliable regression harness that protects the new behavior.
