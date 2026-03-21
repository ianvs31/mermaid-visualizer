import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serializeMermaidFlowchartV2 } from "./serializer";
import { useEditorStore } from "./store";
import type { DiagramModel } from "./types";

function createModel(): DiagramModel {
  return {
    version: 2,
    direction: "LR",
    rawPassthroughStatements: [],
    groups: [],
    nodes: [
      { id: "N1", type: "start", label: "开始", x: 80, y: 120, width: 130, height: 66 },
      { id: "N2", type: "process", label: "处理", x: 280, y: 120, width: 148, height: 72 },
    ],
    edges: [{ id: "E1", from: "N1", to: "N2", label: "" }],
  };
}

function createGroupedModel(): DiagramModel {
  return {
    version: 2,
    direction: "LR",
    rawPassthroughStatements: [],
    groups: [
      {
        id: "G1",
        type: "swimlane",
        title: "业务侧",
        direction: "LR",
        parentGroupId: undefined,
        childNodeIds: [],
        childGroupIds: [],
        laneMeta: { orientation: "horizontal", order: 1 },
        x: 40,
        y: 40,
        width: 320,
        height: 180,
      },
    ],
    nodes: [{ id: "N1", type: "start", label: "开始", x: 80, y: 120, width: 130, height: 66 }],
    edges: [],
  };
}

function resetStore(model = createModel()): void {
  useEditorStore.setState((state) => ({
    ...state,
    model,
    code: serializeMermaidFlowchartV2(model),
    codeDirty: false,
    warnings: [],
    inlineEditSession: undefined,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    clipboard: undefined,
    past: [],
    future: [],
    toastTick: 0,
    pendingRenderTick: 0,
    fitViewTick: 0,
  }));
}

describe("editor store shortcuts state", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("deletes selected nodes and linked edges", () => {
    const store = useEditorStore.getState();
    store.setSelection(["N1"], [], []);
    store.deleteSelection();

    const next = useEditorStore.getState();
    expect(next.model.nodes.map((node) => node.id)).toEqual(["N2"]);
    expect(next.model.edges).toHaveLength(0);
  });

  it("undoes and redoes canvas mutations", () => {
    const store = useEditorStore.getState();
    store.addNode("process", { x: 420, y: 220 });
    expect(useEditorStore.getState().model.nodes).toHaveLength(3);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().model.nodes).toHaveLength(2);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().model.nodes).toHaveLength(3);
  });

  it("copies and pastes selected nodes with internal edges", () => {
    const store = useEditorStore.getState();
    store.setSelection(["N1", "N2"], [], []);
    store.copySelection();
    store.pasteClipboard();

    const next = useEditorStore.getState();
    expect(next.model.nodes).toHaveLength(4);
    expect(next.model.edges).toHaveLength(2);
    expect(next.selectedNodeIds).toHaveLength(2);
  });

  it("cuts selected nodes into clipboard", () => {
    const store = useEditorStore.getState();
    store.setSelection(["N1"], [], []);
    store.cutSelection();

    const next = useEditorStore.getState();
    expect(next.clipboard?.nodes).toHaveLength(1);
    expect(next.model.nodes.map((node) => node.id)).toEqual(["N2"]);
  });

  it("updates group title and serializes nested nodes after reassignment", () => {
    resetStore(createGroupedModel());
    const store = useEditorStore.getState();

    store.updateGroupTitle("G1", "执行泳道");
    store.updateNodeParentGroup("N1", "G1");
    store.syncCodeFromModel();

    const next = useEditorStore.getState();
    expect(next.code).toContain("subgraph G1[执行泳道]");
    expect(next.code).toContain("%% editor:lane G1 horizontal 1");
    expect(next.code).toContain("N1(开始)");
  });

  it("clears node parent when dragged out of a swimlane", () => {
    resetStore(createGroupedModel());
    const store = useEditorStore.getState();

    store.updateNodeParentGroup("N1", "G1");
    store.updateNodeParentGroup("N1", undefined);
    store.syncCodeFromModel();

    const next = useEditorStore.getState();
    expect(next.model.nodes.find((node) => node.id === "N1")?.parentGroupId).toBeUndefined();
    expect(next.code).toMatch(/subgraph G1\[业务侧\][\s\S]*end[\s\S]*N1\(开始\)/);
  });

  it("creates a swimlane from explicit drag bounds", () => {
    resetStore(createModel());
    const store = useEditorStore.getState();

    store.addSwimlane("vertical", { x: 160, y: 200, width: 180, height: 260 });

    const next = useEditorStore.getState();
    const created = next.model.groups.at(-1);
    expect(created?.type).toBe("swimlane");
    expect(created?.x).toBe(160);
    expect(created?.y).toBe(200);
    expect(created?.width).toBeGreaterThanOrEqual(220);
    expect(created?.height).toBeGreaterThanOrEqual(320);
    expect(next.selectedGroupIds).toEqual([created?.id]);
  });

  it("updates selected node appearance and serializes editor metadata", () => {
    resetStore(createModel());
    const store = useEditorStore.getState();

    store.setSelection(["N2"], [], []);
    store.updateSelectedNodeAppearance({
      fillColor: "#eb5c33",
      strokeColor: "#1f2937",
      fillMode: "transparent",
      strokePattern: "dashed",
      cornerRadius: 24,
    });

    const next = useEditorStore.getState();
    expect(next.model.nodes.find((node) => node.id === "N2")?.appearance?.fillColor).toBe("#eb5c33");
    expect(next.model.nodes.find((node) => node.id === "N2")?.appearance?.strokeColor).toBe("#1f2937");
    expect(next.code).toContain("%% editor:appearance N2 fillMode=transparent fillColor=#eb5c33 strokeColor=#1f2937 strokePattern=dashed radius=24 width=2");
  });

  it("prefers restoring a saved draft over loading the sample", () => {
    const restoredModel: DiagramModel = {
      version: 2,
      direction: "LR",
      rawPassthroughStatements: [],
      groups: [],
      nodes: [
        { id: "R1", type: "start", label: "恢复开始", x: 80, y: 120, width: 130, height: 66 },
        { id: "R2", type: "process", label: "恢复处理", x: 280, y: 120, width: 148, height: 72 },
      ],
      edges: [{ id: "RE1", from: "R1", to: "R2", label: "" }],
    };

    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
        code: "flowchart LR\nR1-->R2",
        codeDirty: false,
        model: restoredModel,
      }),
    );

    useEditorStore.getState().init();

    expect(useEditorStore.getState().code).toContain("R1-->R2");
    expect(useEditorStore.getState().message.text).toContain("恢复");
  });

  it("restores codeDirty from a dirty draft snapshot", () => {
    const restoredModel: DiagramModel = {
      version: 2,
      direction: "LR",
      rawPassthroughStatements: [],
      groups: [],
      nodes: [
        { id: "R1", type: "start", label: "恢复开始", x: 80, y: 120, width: 130, height: 66 },
        { id: "R2", type: "process", label: "恢复处理", x: 280, y: 120, width: 148, height: 72 },
      ],
      edges: [{ id: "RE1", from: "R1", to: "R2", label: "" }],
    };

    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
        code: "flowchart LR\nR1-->R2",
        codeDirty: true,
        model: restoredModel,
      }),
    );

    useEditorStore.getState().init();

    expect(useEditorStore.getState().codeDirty).toBe(true);
  });
});
