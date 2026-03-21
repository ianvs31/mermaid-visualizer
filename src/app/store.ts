import { create } from "zustand";
import { resolveNodeAppearance, stripPaintStyle } from "./appearance";
import { buildExportText, exportMimeTypeFor, type ExportFormat } from "./export";
import { defaultFilenameFor, downloadTextFile } from "./file-io";
import { applyElkLayout } from "./layout";
import { loadDraftSnapshot } from "./persistence";
import { parseMermaidFlowchartV2 } from "./parser";
import { serializeMermaidFlowchartV2 } from "./serializer";
import {
  DEFAULT_DIRECTION,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramModel,
  type DiagramNode,
  type DiagramNodeType,
  type EdgeHandlePosition,
  type EditorMessage,
  type InlineEditSession,
  type InteractionState,
  type NodeAppearance,
  type ToolMode,
  type UiPreset,
  createEmptyModel,
} from "./types";

interface HistorySnapshot {
  model: DiagramModel;
  code: string;
  codeDirty: boolean;
  warnings: string[];
}

interface ClipboardSnapshot {
  nodes: DiagramNode[];
  groups: DiagramGroup[];
  edges: DiagramEdge[];
}

interface EditorState {
  model: DiagramModel;
  code: string;
  codeDirty: boolean;
  warnings: string[];
  message: EditorMessage;
  inlineEditSession?: InlineEditSession;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
  interaction: InteractionState;
  reconnectingEdgeId?: string;
  reconnectingEndpoint?: "source" | "target";
  clipboard?: ClipboardSnapshot;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  zoom: number;
  toastTick: number;
  pendingRenderTick: number;
  fitViewTick: number;
  init: () => void;
  setZoom: (zoom: number) => void;
  setCode: (code: string) => void;
  notify: (tone: EditorMessage["tone"], text: string) => void;
  setToolMode: (mode: ToolMode) => void;
  toggleSnap: () => void;
  setUiPreset: (preset: UiPreset) => void;
  setViewportHudVisible: (visible: boolean) => void;
  syncCodeFromModel: () => void;
  applyCodeToModel: (options?: { fitView?: boolean; quiet?: boolean }) => Promise<void>;
  replaceModel: (model: DiagramModel, note?: string, options?: { recordHistory?: boolean }) => void;
  newDocument: () => void;
  openMermaidText: (text: string) => Promise<void>;
  downloadExport: (format: ExportFormat) => void;
  beginInlineEdit: (session: InlineEditSession) => void;
  endInlineEdit: () => void;
  setSelection: (nodeIds: string[], edgeIds: string[], groupIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  styleSelectedNodes: (style: Record<string, string>) => void;
  updateSelectedNodeAppearance: (patch: Partial<NodeAppearance>) => void;
  addNode: (type: DiagramNodeType, position?: { x: number; y: number }, parentGroupId?: string) => string;
  addSubgraph: () => void;
  addSwimlane: (
    orientation: "horizontal" | "vertical",
    bounds?: { x: number; y: number; width: number; height: number },
  ) => string;
  assignSelectionToGroup: () => void;
  toggleGroupCollapse: (groupId: string) => void;
  updateNodeGeometry: (
    nodeId: string,
    x: number,
    y: number,
    width?: number,
    height?: number,
    recordHistory?: boolean,
  ) => void;
  updateGroupGeometry: (
    groupId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    recordHistory?: boolean,
  ) => void;
  upsertEdge: (
    from: string,
    to: string,
    label?: string,
    sourceHandle?: EdgeHandlePosition,
    targetHandle?: EdgeHandlePosition,
  ) => void;
  startEdgeReconnect: (edgeId: string, endpoint: "source" | "target") => void;
  finishEdgeReconnect: (params: {
    edgeId: string;
    source: string;
    target: string;
    sourceHandle?: EdgeHandlePosition;
    targetHandle?: EdgeHandlePosition;
  }) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeParentGroup: (nodeId: string, parentGroupId?: string, recordHistory?: boolean) => void;
  updateGroupTitle: (groupId: string, title: string) => void;
  commitNodeLabel: (nodeId: string, label: string) => void;
  commitGroupTitle: (groupId: string, title: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  clear: () => void;
  loadSample: (options?: { recordHistory?: boolean }) => void;
  autoLayout: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  model: createEmptyModel(),
  code: "",
  codeDirty: false,
  warnings: [],
  message: { tone: "info", text: "可直接编辑 Mermaid 文本" },
  inlineEditSession: undefined,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedGroupIds: [],
  interaction: createDefaultInteraction(),
  reconnectingEdgeId: undefined,
  reconnectingEndpoint: undefined,
  clipboard: undefined,
  past: [],
  future: [],
  zoom: 1,
  toastTick: 0,
  pendingRenderTick: 0,
  fitViewTick: 0,

  init: () => {
    const uiPreset = readUiPresetFromUrl();
    get().setUiPreset(uiPreset);
    const restored = loadDraftSnapshot();
    if (restored) {
      get().replaceModel(restored.model, "已恢复本地草稿", { recordHistory: false });
      set({
        code: restored.code,
        codeDirty: restored.codeDirty,
        warnings: [],
        fitViewTick: Date.now(),
      });
      return;
    }
    get().loadSample({ recordHistory: false });
  },

  setZoom: (zoom) => set({ zoom }),

  setCode: (code) => {
    set((state) => {
      if (state.code === code) {
        return state;
      }

      return {
        ...(state.codeDirty ? {} : pushHistory(state)),
        code,
        codeDirty: true,
        message: { tone: "info", text: "正在同步 Mermaid 文本" },
        pendingRenderTick: Date.now(),
      };
    });
  },

  notify: (tone, text) => {
    set({
      message: { tone, text },
      toastTick: Date.now(),
    });
  },

  setToolMode: (mode) => {
    set((state) => ({
      interaction: {
        ...state.interaction,
        toolMode: mode,
      },
    }));
  },

  toggleSnap: () => {
    set((state) => ({
      interaction: {
        ...state.interaction,
        snapToGrid: !state.interaction.snapToGrid,
      },
      toastTick: Date.now(),
      message: {
        tone: "info",
        text: state.interaction.snapToGrid ? "已关闭网格吸附" : "已开启网格吸附",
      },
    }));
  },

  setUiPreset: (preset) => {
    writeUiPresetToUrl(preset);
    set((state) => ({
      interaction: {
        ...state.interaction,
        uiPreset: preset,
      },
      toastTick: Date.now(),
      message: {
        tone: "info",
        text: preset === "figjam" ? "已切换 FigJam 交互" : "已切换 classic 交互",
      },
    }));
  },

  setViewportHudVisible: (visible) => {
    set((state) => ({
      interaction: {
        ...state.interaction,
        viewportHudVisible: visible,
      },
    }));
  },

  syncCodeFromModel: () => {
    const model = get().model;
    const code = serializeMermaidFlowchartV2(model);
    set({ code, codeDirty: false, warnings: [], pendingRenderTick: Date.now() });
  },

  applyCodeToModel: async (options = {}) => {
    const { code } = get();
    const parsed = parseMermaidFlowchartV2(code);

    if (parsed.errors.length > 0) {
      set({
        warnings: parsed.errors,
        message: { tone: "error", text: parsed.errors[0] },
        toastTick: options.quiet ? get().toastTick : Date.now(),
      });
      return;
    }

    const layouted = await applyElkLayout(parsed.model, {
      direction: parsed.model.direction,
      layerSpacing: 100,
      nodeSpacing: 56,
    });

    set({
      model: layouted,
      warnings: parsed.warnings,
      codeDirty: false,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      reconnectingEdgeId: undefined,
      reconnectingEndpoint: undefined,
      message: {
        tone: parsed.warnings.length ? "info" : "success",
        text: parsed.warnings.length ? parsed.warnings[0] : "已实时同步到画布",
      },
      pendingRenderTick: Date.now(),
      fitViewTick: options.fitView ? Date.now() : get().fitViewTick,
      toastTick: options.quiet ? get().toastTick : Date.now(),
    });
  },

  replaceModel: (model, note = "已导入模型", options = {}) => {
    const normalized = structuredClone(model) as DiagramModel;
    const recordHistory = options.recordHistory ?? true;
    normalizeChildren(normalized);
    set((state) => ({
      ...(recordHistory ? pushHistory(state) : { past: [], future: [] }),
      model: normalized,
      warnings: [],
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      reconnectingEdgeId: undefined,
      reconnectingEndpoint: undefined,
      codeDirty: false,
      message: { tone: "success", text: note },
      pendingRenderTick: Date.now(),
      toastTick: Date.now(),
    }));
    get().syncCodeFromModel();
  },

  newDocument: () => {
    set((state) => ({
      ...pushHistory(state),
      model: createEmptyModel(),
      code: `flowchart ${DEFAULT_DIRECTION}`,
      codeDirty: false,
      warnings: [],
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      reconnectingEdgeId: undefined,
      reconnectingEndpoint: undefined,
      message: { tone: "success", text: "已新建图表" },
      pendingRenderTick: Date.now(),
      fitViewTick: Date.now(),
      toastTick: Date.now(),
    }));
  },

  openMermaidText: async (text) => {
    const nextCode = normalizeOpenedMermaidText(text);
    if (!nextCode) {
      set({
        message: { tone: "error", text: "Mermaid 内容为空，打开已取消" },
        toastTick: Date.now(),
      });
      return;
    }

    const parsed = parseMermaidFlowchartV2(nextCode);
    if (parsed.errors.length > 0) {
      set({
        warnings: parsed.errors,
        message: { tone: "error", text: parsed.errors[0] },
        toastTick: Date.now(),
      });
      return;
    }

    const layouted = await applyElkLayout(parsed.model, {
      direction: parsed.model.direction,
      layerSpacing: 100,
      nodeSpacing: 56,
    });

    set((state) => ({
      ...pushHistory(state),
      model: layouted,
      code: nextCode,
      codeDirty: false,
      warnings: parsed.warnings,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      reconnectingEdgeId: undefined,
      reconnectingEndpoint: undefined,
      message: {
        tone: parsed.warnings.length ? "info" : "success",
        text: parsed.warnings.length ? parsed.warnings[0] : "已打开 Mermaid 文件",
      },
      pendingRenderTick: Date.now(),
      fitViewTick: Date.now(),
      toastTick: Date.now(),
    }));
  },

  downloadExport: (format) => {
    const model = get().model;

    try {
      downloadTextFile(defaultFilenameFor(format), buildExportText(format, model), exportMimeTypeFor(format));
      set({
        message: {
          tone: "success",
          text:
            format === "drawio-xml"
              ? "已下载 draw.io XML"
              : format === "editor-json"
                ? "已下载 JSON"
                : "已下载 Mermaid",
        },
        toastTick: Date.now(),
      });
    } catch {
      set({
        message: { tone: "error", text: "下载失败，请检查浏览器权限" },
        toastTick: Date.now(),
      });
    }
  },

  beginInlineEdit: (session) => {
    set({ inlineEditSession: session });
  },

  endInlineEdit: () => {
    set({ inlineEditSession: undefined });
  },

  setSelection: (nodeIds, edgeIds, groupIds) => {
    set((state) => {
      if (
        sameIdList(state.selectedNodeIds, nodeIds) &&
        sameIdList(state.selectedEdgeIds, edgeIds) &&
        sameIdList(state.selectedGroupIds, groupIds)
      ) {
        return state;
      }

      return {
        selectedNodeIds: nodeIds,
        selectedEdgeIds: edgeIds,
        selectedGroupIds: groupIds,
      };
    });
  },

  undo: () => {
    set((state) => {
      const snapshot = state.past.at(-1);
      if (!snapshot) {
        return state;
      }

      return {
        ...restoreHistorySnapshot(snapshot),
        past: state.past.slice(0, -1),
        future: [...state.future.slice(-(MAX_HISTORY - 1)), createHistorySnapshot(state)],
        inlineEditSession: undefined,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        reconnectingEdgeId: undefined,
        reconnectingEndpoint: undefined,
        message: { tone: "info", text: "已撤销" },
        toastTick: Date.now(),
        pendingRenderTick: Date.now(),
      };
    });
  },

  redo: () => {
    set((state) => {
      const snapshot = state.future.at(-1);
      if (!snapshot) {
        return state;
      }

      return {
        ...restoreHistorySnapshot(snapshot),
        future: state.future.slice(0, -1),
        past: [...state.past.slice(-(MAX_HISTORY - 1)), createHistorySnapshot(state)],
        inlineEditSession: undefined,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        reconnectingEdgeId: undefined,
        reconnectingEndpoint: undefined,
        message: { tone: "info", text: "已重做" },
        toastTick: Date.now(),
        pendingRenderTick: Date.now(),
      };
    });
  },

  copySelection: () => {
    const state = get();
    const clipboard = buildClipboardFromSelection(state);
    if (!clipboard) {
      set({ message: { tone: "info", text: "没有可复制的内容" }, toastTick: Date.now() });
      return;
    }

    set({
      clipboard,
      message: { tone: "success", text: `已复制 ${clipboard.nodes.length + clipboard.groups.length} 个元素` },
      toastTick: Date.now(),
    });
  },

  cutSelection: () => {
    const state = get();
    const clipboard = buildClipboardFromSelection(state);
    if (!clipboard) {
      set({ message: { tone: "info", text: "没有可剪切的内容" }, toastTick: Date.now() });
      return;
    }

    const nextModel = removeSelectionFromModel(state);
    set({
      ...pushHistory(state),
      clipboard,
      model: nextModel,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      message: { tone: "success", text: "已剪切选中内容" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard) {
      set({ message: { tone: "info", text: "剪贴板为空" }, toastTick: Date.now() });
      return;
    }

    const pasted = pasteClipboardIntoModel(state.model, state.clipboard);
    set({
      ...pushHistory(state),
      model: pasted.model,
      inlineEditSession: undefined,
      selectedNodeIds: pasted.selectedNodeIds,
      selectedEdgeIds: pasted.selectedEdgeIds,
      selectedGroupIds: pasted.selectedGroupIds,
      message: { tone: "success", text: `已粘贴 ${pasted.selectedNodeIds.length + pasted.selectedGroupIds.length} 个元素` },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  deleteSelection: () => {
    const state = get();
    if (!state.selectedNodeIds.length && !state.selectedEdgeIds.length && !state.selectedGroupIds.length) {
      return;
    }
    const nextModel = removeSelectionFromModel(state);

    set({
      ...pushHistory(state),
      model: nextModel,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      message: { tone: "success", text: "已删除选中元素" },
      codeDirty: false,
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  duplicateSelection: () => {
    const state = get();
    const clipboard = buildClipboardFromSelection(state);
    if (!clipboard) {
      return;
    }

    const pasted = pasteClipboardIntoModel(state.model, clipboard);
    set({
      ...pushHistory(state),
      model: pasted.model,
      inlineEditSession: undefined,
      selectedNodeIds: pasted.selectedNodeIds,
      selectedEdgeIds: pasted.selectedEdgeIds,
      selectedGroupIds: pasted.selectedGroupIds,
      message: { tone: "success", text: `已复制 ${pasted.selectedNodeIds.length} 个节点` },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  styleSelectedNodes: (stylePatch) => {
    const state = get();
    if (state.selectedNodeIds.length === 0) {
      return;
    }
    const selected = new Set(state.selectedNodeIds);

    const nodes = state.model.nodes.map((node) =>
      selected.has(node.id)
        ? {
            ...node,
            style: {
              ...(node.style || {}),
              ...stylePatch,
            },
          }
        : node,
    );

    set({
      ...pushHistory(state),
      model: {
        ...state.model,
        nodes,
      },
      message: { tone: "success", text: "已应用样式到选中节点" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  updateSelectedNodeAppearance: (patch) => {
    const state = get();
    if (state.selectedNodeIds.length === 0) {
      return;
    }

    const selected = new Set(state.selectedNodeIds);
    const nodes = state.model.nodes.map((node) => {
      if (!selected.has(node.id)) {
        return node;
      }

      return {
        ...node,
        appearance: {
          ...resolveNodeAppearance(node),
          ...patch,
        },
        style: stripPaintStyle(node.style),
      };
    });

    set({
      ...pushHistory(state),
      model: {
        ...state.model,
        nodes,
      },
      message: { tone: "success", text: "已更新节点外观" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  addNode: (type, position, parentGroupId) => {
    const state = get();
    const nextId = nextNodeId(state.model.nodes);
    const targetGroupId = parentGroupId ?? state.selectedGroupIds.at(0);
    const parent = targetGroupId ? state.model.groups.find((group) => group.id === targetGroupId) : undefined;

    const node: DiagramNode = {
      id: nextId,
      type,
      label: defaultNodeLabel(type),
      x: position?.x ?? (parent ? parent.x + 40 : 120),
      y: position?.y ?? (parent ? parent.y + 80 : 120),
      width: type === "decision" ? 132 : 148,
      height: type === "decision" ? 132 : 72,
      parentGroupId: parent?.id,
    };

    const model: DiagramModel = {
      ...state.model,
      nodes: [...state.model.nodes, node],
    };

    normalizeChildren(model);
    set({
      ...pushHistory(state),
      model,
      inlineEditSession: undefined,
      codeDirty: false,
      message: { tone: "success", text: `已添加节点 ${node.id}` },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
    return nextId;
  },

  addSubgraph: () => {
    const state = get();
    const id = nextGroupId(state.model.groups);
    const group: DiagramGroup = {
      id,
      type: "subgraph",
      title: `分区 ${id}`,
      direction: undefined,
      parentGroupId: state.selectedGroupIds.at(0),
      childNodeIds: [],
      childGroupIds: [],
      x: 80,
      y: 80,
      width: 460,
      height: 240,
      collapsed: false,
    };

    const model: DiagramModel = {
      ...state.model,
      groups: [...state.model.groups, group],
    };

    normalizeChildren(model);
    set({
      ...pushHistory(state),
      model,
      message: { tone: "success", text: `已创建 subgraph ${id}` },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  addSwimlane: (orientation, bounds) => {
    const state = get();
    const id = nextGroupId(state.model.groups);
    const laneCount = state.model.groups.filter((group) => group.type === "swimlane").length;
    const nextBounds = bounds
      ? {
          x: bounds.x,
          y: bounds.y,
          width: Math.max(bounds.width, orientation === "vertical" ? 220 : 260),
          height: Math.max(bounds.height, orientation === "vertical" ? 320 : 140),
        }
      : {
          x: 100,
          y: 100 + laneCount * 48,
          width: orientation === "vertical" ? 280 : 620,
          height: orientation === "vertical" ? 560 : 220,
        };

    const group: DiagramGroup = {
      id,
      type: "swimlane",
      title: `泳道 ${laneCount + 1}`,
      direction: orientation === "vertical" ? "TB" : "LR",
      parentGroupId: state.selectedGroupIds.at(0),
      childNodeIds: [],
      childGroupIds: [],
      laneMeta: { orientation, order: laneCount + 1 },
      x: nextBounds.x,
      y: nextBounds.y,
      width: nextBounds.width,
      height: nextBounds.height,
      collapsed: false,
    };

    const model: DiagramModel = {
      ...state.model,
      groups: [...state.model.groups, group],
    };

    normalizeChildren(model);
    set({
      ...pushHistory(state),
      model,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [id],
      message: { tone: "success", text: `已创建泳道 ${id}` },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
    return id;
  },

  assignSelectionToGroup: () => {
    const state = get();
    if (state.selectedGroupIds.length !== 1 || state.selectedNodeIds.length === 0) {
      set({ message: { tone: "info", text: "请先选中 1 个分区和至少 1 个节点" }, toastTick: Date.now() });
      return;
    }

    const targetGroupId = state.selectedGroupIds[0];
    const nodeSet = new Set(state.selectedNodeIds);

    const model: DiagramModel = {
      ...state.model,
      nodes: state.model.nodes.map((node) => (nodeSet.has(node.id) ? { ...node, parentGroupId: targetGroupId } : node)),
    };

    normalizeChildren(model);
    set({
      ...pushHistory(state),
      model,
      inlineEditSession: undefined,
      message: { tone: "success", text: "已把选中节点移入分区" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  toggleGroupCollapse: (groupId) => {
    const state = get();
    const groups = state.model.groups.map((group) =>
      group.id === groupId ? { ...group, collapsed: !group.collapsed } : group,
    );

    const model = { ...state.model, groups };
    set({ ...pushHistory(state), model });
  },

  updateNodeGeometry: (nodeId, x, y, width, height, recordHistory = false) => {
    const state = get();
    const current = state.model.nodes.find((node) => node.id === nodeId);
    if (!current) {
      return;
    }

    const nextWidth = width ?? current.width;
    const nextHeight = height ?? current.height;
    if (
      current.x === x &&
      current.y === y &&
      current.width === nextWidth &&
      current.height === nextHeight
    ) {
      return;
    }

    const nodes = state.model.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            x,
            y,
            width: nextWidth,
            height: nextHeight,
          }
        : node,
    );

    set({
      ...(recordHistory ? pushHistory(state) : {}),
      model: { ...state.model, nodes },
    });
  },

  updateGroupGeometry: (groupId, x, y, width, height, recordHistory = false) => {
    const state = get();
    const current = state.model.groups.find((group) => group.id === groupId);
    if (!current) {
      return;
    }
    if (current.x === x && current.y === y && current.width === width && current.height === height) {
      return;
    }
    const deltaX = x - current.x;
    const deltaY = y - current.y;
    const descendantIds = new Set(collectDescendantGroupIds(groupId, state.model.groups));

    const groups = state.model.groups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          x,
          y,
          width,
          height,
        };
      }
      if (descendantIds.has(group.id) && (deltaX !== 0 || deltaY !== 0)) {
        return {
          ...group,
          x: group.x + deltaX,
          y: group.y + deltaY,
        };
      }
      return group;
    });

    const nodes = state.model.nodes.map((node) =>
      node.parentGroupId && (node.parentGroupId === groupId || descendantIds.has(node.parentGroupId)) && (deltaX !== 0 || deltaY !== 0)
        ? {
            ...node,
            x: node.x + deltaX,
            y: node.y + deltaY,
          }
        : node,
    );

    set({
      ...(recordHistory ? pushHistory(state) : {}),
      model: { ...state.model, groups, nodes },
    });
  },

  upsertEdge: (from, to, label = "", sourceHandle, targetHandle) => {
    const state = get();
    const exists = state.model.edges.find(
      (edge) =>
        edge.from === from &&
        edge.to === to &&
        (sourceHandle ? edge.sourceHandle === sourceHandle : true) &&
        (targetHandle ? edge.targetHandle === targetHandle : true),
    );
    if (exists) {
      return;
    }

    const nextId = nextEdgeId(state.model.edges);
    const model = {
      ...state.model,
      edges: [...state.model.edges, { id: nextId, from, to, label, sourceHandle, targetHandle }],
    };

    set({
      ...pushHistory(state),
      model,
      message: { tone: "success", text: "已创建连线" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  startEdgeReconnect: (edgeId, endpoint) => {
    set({
      reconnectingEdgeId: edgeId,
      reconnectingEndpoint: endpoint,
    });
  },

  finishEdgeReconnect: ({ edgeId, source, target, sourceHandle, targetHandle }) => {
    const state = get();
    const edges = state.model.edges.map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            from: source,
            to: target,
            sourceHandle,
            targetHandle,
          }
        : edge,
    );

    set({
      ...pushHistory(state),
      model: {
        ...state.model,
        edges,
      },
      reconnectingEdgeId: undefined,
      reconnectingEndpoint: undefined,
      message: { tone: "success", text: "已更新连线端点" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  updateNodeLabel: (nodeId, label) => {
    const state = get();
    const current = state.model.nodes.find((node) => node.id === nodeId);
    if (!current || current.label === label) {
      return;
    }
    const nodes = state.model.nodes.map((node) => (node.id === nodeId ? { ...node, label } : node));
    set({ ...pushHistory(state), model: { ...state.model, nodes }, toastTick: Date.now() });
    get().syncCodeFromModel();
  },

  commitNodeLabel: (nodeId, label) => {
    const state = get();
    const current = state.model.nodes.find((node) => node.id === nodeId);
    if (!current) {
      set({ inlineEditSession: undefined });
      return;
    }
    if (current.label === label) {
      set({ inlineEditSession: undefined });
      return;
    }
    const nodes = state.model.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            label,
            type:
              node.type === "start" || node.type === "terminator"
                ? normalizeRoundedNodeType(label)
                : node.type,
          }
        : node,
    );
    set({
      ...pushHistory(state),
      model: { ...state.model, nodes },
      inlineEditSession: undefined,
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },

  updateNodeParentGroup: (nodeId, parentGroupId, recordHistory = false) => {
    const state = get();
    const current = state.model.nodes.find((node) => node.id === nodeId);
    if (!current || current.parentGroupId === parentGroupId) {
      return;
    }
    const nodes = state.model.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            parentGroupId,
          }
        : node,
    );

    const model = {
      ...state.model,
      nodes,
    };
    normalizeChildren(model);

    set({
      ...(recordHistory ? pushHistory(state) : {}),
      model,
    });
  },

  updateGroupTitle: (groupId, title) => {
    const state = get();
    const current = state.model.groups.find((group) => group.id === groupId);
    if (!current || current.title === title) {
      return;
    }
    const groups = state.model.groups.map((group) => (group.id === groupId ? { ...group, title } : group));
    const model = {
      ...state.model,
      groups,
    };
    normalizeChildren(model);
    set({ ...pushHistory(state), model, toastTick: Date.now() });
    get().syncCodeFromModel();
  },

  commitGroupTitle: (groupId, title) => {
    const state = get();
    const current = state.model.groups.find((group) => group.id === groupId);
    if (!current) {
      set({ inlineEditSession: undefined });
      return;
    }
    if (current.title === title) {
      set({ inlineEditSession: undefined });
      return;
    }
    const groups = state.model.groups.map((group) => (group.id === groupId ? { ...group, title } : group));
    const model = {
      ...state.model,
      groups,
    };
    normalizeChildren(model);
    set({ ...pushHistory(state), model, inlineEditSession: undefined, toastTick: Date.now() });
    get().syncCodeFromModel();
  },

  updateEdgeLabel: (edgeId, label) => {
    const state = get();
    const current = state.model.edges.find((edge) => edge.id === edgeId);
    if (!current || current.label === label) {
      return;
    }
    const edges = state.model.edges.map((edge) => (edge.id === edgeId ? { ...edge, label } : edge));
    set({ ...pushHistory(state), model: { ...state.model, edges }, toastTick: Date.now() });
    get().syncCodeFromModel();
  },

  clear: () => {
    set((state) => ({
      ...pushHistory(state),
      model: { ...createEmptyModel(), direction: DEFAULT_DIRECTION },
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      warnings: [],
      message: { tone: "info", text: "画布已清空" },
      codeDirty: false,
      toastTick: Date.now(),
    }));
    get().syncCodeFromModel();
  },

  loadSample: (options = {}) => {
    const model = createSampleModel();
    const recordHistory = options.recordHistory ?? true;
    set((state) => ({
      ...(recordHistory ? pushHistory(state) : { past: [], future: [] }),
      model,
      inlineEditSession: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      warnings: [],
      codeDirty: false,
      message: { tone: "info", text: "已加载示例" },
      fitViewTick: Date.now(),
      toastTick: Date.now(),
    }));
    get().syncCodeFromModel();
  },

  autoLayout: async () => {
    const state = get();
    const layouted = await applyElkLayout(state.model, {
      direction: state.model.direction,
      layerSpacing: 100,
      nodeSpacing: 56,
    });

    set({
      ...pushHistory(state),
      model: layouted,
      inlineEditSession: undefined,
      message: { tone: "success", text: "已完成自动布局" },
      toastTick: Date.now(),
    });
    get().syncCodeFromModel();
  },
}));

const MAX_HISTORY = 100;

function createHistorySnapshot(
  state: Pick<EditorState, "model" | "code" | "codeDirty" | "warnings">,
): HistorySnapshot {
  return {
    model: structuredClone(state.model),
    code: state.code,
    codeDirty: state.codeDirty,
    warnings: [...state.warnings],
  };
}

function restoreHistorySnapshot(snapshot: HistorySnapshot): Pick<EditorState, "model" | "code" | "codeDirty" | "warnings"> {
  return {
    model: structuredClone(snapshot.model),
    code: snapshot.code,
    codeDirty: snapshot.codeDirty,
    warnings: [...snapshot.warnings],
  };
}

function pushHistory(
  state: Pick<EditorState, "model" | "code" | "codeDirty" | "warnings" | "past">,
): Pick<EditorState, "past" | "future"> {
  return {
    past: [...state.past.slice(-(MAX_HISTORY - 1)), createHistorySnapshot(state)],
    future: [],
  };
}

function normalizeOpenedMermaidText(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```mermaid\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  return trimmed;
}

function buildClipboardFromSelection(state: Pick<EditorState, "model" | "selectedNodeIds" | "selectedGroupIds">): ClipboardSnapshot | null {
  const selectedGroupIds = new Set(state.selectedGroupIds);
  const groupIdsToCopy = new Set<string>();

  for (const groupId of selectedGroupIds) {
    groupIdsToCopy.add(groupId);
    for (const descendantId of collectDescendantGroupIds(groupId, state.model.groups)) {
      groupIdsToCopy.add(descendantId);
    }
  }

  const selectedNodeIds = new Set(state.selectedNodeIds);
  const nodes = state.model.nodes
    .filter((node) => selectedNodeIds.has(node.id) || (node.parentGroupId ? groupIdsToCopy.has(node.parentGroupId) : false))
    .map((node) => structuredClone(node));

  const groups = state.model.groups
    .filter((group) => groupIdsToCopy.has(group.id))
    .map((group) => structuredClone(group));

  if (nodes.length === 0 && groups.length === 0) {
    return null;
  }

  const nodeIdsToCopy = new Set(nodes.map((node) => node.id));
  const edges = state.model.edges
    .filter((edge) => nodeIdsToCopy.has(edge.from) && nodeIdsToCopy.has(edge.to))
    .map((edge) => structuredClone(edge));

  return { nodes, groups, edges };
}

function removeSelectionFromModel(
  state: Pick<EditorState, "model" | "selectedNodeIds" | "selectedEdgeIds" | "selectedGroupIds">,
): DiagramModel {
  const selectedNodeIdSet = new Set(state.selectedNodeIds);
  const selectedGroupIdSet = new Set<string>();

  for (const groupId of state.selectedGroupIds) {
    selectedGroupIdSet.add(groupId);
    for (const descendantId of collectDescendantGroupIds(groupId, state.model.groups)) {
      selectedGroupIdSet.add(descendantId);
    }
  }

  const nextModel: DiagramModel = {
    ...state.model,
    nodes: state.model.nodes.filter(
      (node) => !selectedNodeIdSet.has(node.id) && !(node.parentGroupId && selectedGroupIdSet.has(node.parentGroupId)),
    ),
    groups: state.model.groups.filter((group) => !selectedGroupIdSet.has(group.id)),
    edges: state.model.edges.filter(
      (edge) =>
        !state.selectedEdgeIds.includes(edge.id) &&
        !selectedNodeIdSet.has(edge.from) &&
        !selectedNodeIdSet.has(edge.to),
    ),
  };

  const remainingNodeIds = new Set(nextModel.nodes.map((node) => node.id));
  nextModel.edges = nextModel.edges.filter(
    (edge) => remainingNodeIds.has(edge.from) && remainingNodeIds.has(edge.to),
  );

  nextModel.nodes = nextModel.nodes.map((node) =>
    node.parentGroupId && selectedGroupIdSet.has(node.parentGroupId)
      ? { ...node, parentGroupId: undefined }
      : node,
  );

  nextModel.groups = nextModel.groups.map((group) =>
    group.parentGroupId && selectedGroupIdSet.has(group.parentGroupId)
      ? { ...group, parentGroupId: undefined }
      : group,
  );

  normalizeChildren(nextModel);
  return nextModel;
}

function pasteClipboardIntoModel(
  model: DiagramModel,
  clipboard: ClipboardSnapshot,
): {
  model: DiagramModel;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
} {
  const groupIdMap = new Map<string, string>();
  const nodeIdMap = new Map<string, string>();
  let nextGroupSeed = getGroupIdSeed(model.groups);
  let nextNodeSeed = getNodeIdSeed(model.nodes);
  let nextEdgeSeed = getEdgeIdSeed(model.edges);

  const groups = clipboard.groups.map((group) => {
    nextGroupSeed += 1;
    const id = `G${nextGroupSeed}`;
    groupIdMap.set(group.id, id);
    return {
      ...group,
      id,
      x: group.x + 48,
      y: group.y + 48,
      parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : undefined,
      childNodeIds: [],
      childGroupIds: [],
    };
  });

  const nodes = clipboard.nodes.map((node) => {
    nextNodeSeed += 1;
    const id = `N${nextNodeSeed}`;
    nodeIdMap.set(node.id, id);
    return {
      ...node,
      id,
      x: node.x + 48,
      y: node.y + 48,
      parentGroupId: node.parentGroupId ? groupIdMap.get(node.parentGroupId) ?? node.parentGroupId : undefined,
    };
  });

  const edges = clipboard.edges.map((edge) => ({
    ...edge,
    id: `E${++nextEdgeSeed}`,
    from: nodeIdMap.get(edge.from) ?? edge.from,
    to: nodeIdMap.get(edge.to) ?? edge.to,
  }));

  const nextModel: DiagramModel = {
    ...model,
    groups: [...model.groups, ...groups],
    nodes: [...model.nodes, ...nodes],
    edges: [...model.edges, ...edges],
  };
  normalizeChildren(nextModel);

  return {
    model: nextModel,
    selectedNodeIds: nodes.map((node) => node.id),
    selectedEdgeIds: edges.map((edge) => edge.id),
    selectedGroupIds: groups.map((group) => group.id),
  };
}

function nextNodeId(nodes: DiagramNode[]): string {
  return `N${getNodeIdSeed(nodes) + 1}`;
}

function nextGroupId(groups: DiagramGroup[]): string {
  return `G${getGroupIdSeed(groups) + 1}`;
}

function nextEdgeId(edges: DiagramEdge[]): string {
  return `E${getEdgeIdSeed(edges) + 1}`;
}

function getNodeIdSeed(nodes: Array<Pick<DiagramNode, "id">>): number {
  let max = 0;
  for (const node of nodes) {
    const m = node.id.match(/^N(\d+)$/i);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}

function getEdgeIdSeed(edges: Array<Pick<DiagramEdge, "id">>): number {
  let max = 0;
  for (const edge of edges) {
    const m = edge.id.match(/^E(\d+)$/i);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}

function getGroupIdSeed(groups: Array<Pick<DiagramGroup, "id">>): number {
  let max = 0;
  for (const group of groups) {
    const m = group.id.match(/^G(\d+)$/i);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}

function defaultNodeLabel(type: DiagramNodeType): string {
  if (type === "start") {
    return "开始";
  }
  if (type === "terminator") {
    return "结束";
  }
  if (type === "decision") {
    return "是否通过?";
  }
  if (type === "custom") {
    return "自定义节点";
  }
  return "处理步骤";
}

function normalizeRoundedNodeType(label: string): DiagramNodeType {
  if (/(结束|终止|完成|end|stop|done)/i.test(label.trim())) {
    return "terminator";
  }
  return "start";
}

function normalizeChildren(model: DiagramModel): void {
  model.groups = model.groups.map((group) => ({
    ...group,
    childNodeIds: model.nodes.filter((node) => node.parentGroupId === group.id).map((node) => node.id),
    childGroupIds: model.groups.filter((g) => g.parentGroupId === group.id).map((g) => g.id),
  }));
}

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function collectDescendantGroupIds(groupId: string, groups: DiagramGroup[]): string[] {
  const descendants: string[] = [];
  const queue = [groupId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = groups.filter((group) => group.parentGroupId === current).map((group) => group.id);
    descendants.push(...children);
    queue.push(...children);
  }

  return descendants;
}

function createSampleModel(): DiagramModel {
  return {
    version: 2,
    direction: "LR",
    rawPassthroughStatements: [
      "classDef approved fill:#dcfce7,stroke:#15803d,color:#14532d",
      "classDef reject fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d",
      "class N4 approved",
      "class N5 reject",
    ],
    groups: [
      {
        id: "G1",
        type: "swimlane",
        title: "业务侧",
        direction: "LR",
        parentGroupId: undefined,
        childNodeIds: ["N1", "N2", "N3"],
        childGroupIds: [],
        laneMeta: { orientation: "horizontal", order: 1 },
        x: 50,
        y: 40,
        width: 760,
        height: 220,
        collapsed: false,
      },
      {
        id: "G2",
        type: "swimlane",
        title: "执行侧",
        direction: "LR",
        parentGroupId: undefined,
        childNodeIds: ["N4", "N5", "N6"],
        childGroupIds: [],
        laneMeta: { orientation: "horizontal", order: 2 },
        x: 50,
        y: 290,
        width: 760,
        height: 240,
        collapsed: false,
      },
    ],
    nodes: [
      { id: "N1", type: "start", label: "开始", x: 90, y: 115, parentGroupId: "G1", width: 130, height: 66 },
      { id: "N2", type: "process", label: "提交申请", x: 280, y: 115, parentGroupId: "G1", width: 148, height: 72 },
      { id: "N3", type: "decision", label: "审批通过?", x: 500, y: 80, parentGroupId: "G1", width: 132, height: 132 },
      { id: "N4", type: "process", label: "执行任务", x: 540, y: 350, parentGroupId: "G2", width: 148, height: 72 },
      { id: "N5", type: "process", label: "驳回并通知", x: 290, y: 350, parentGroupId: "G2", width: 148, height: 72 },
      { id: "N6", type: "terminator", label: "结束", x: 730, y: 350, parentGroupId: "G2", width: 130, height: 66 },
    ],
    edges: [
      { id: "E1", from: "N1", to: "N2", label: "" },
      { id: "E2", from: "N2", to: "N3", label: "" },
      { id: "E3", from: "N3", to: "N4", label: "是" },
      { id: "E4", from: "N3", to: "N5", label: "否" },
      { id: "E5", from: "N4", to: "N6", label: "" },
      { id: "E6", from: "N5", to: "N6", label: "" },
    ],
  };
}

function createDefaultInteraction(): InteractionState {
  return {
    uiPreset: "figjam",
    toolMode: "select",
    snapToGrid: false,
    snapGrid: [24, 24],
    showHandlesOnHover: true,
    showAlignmentGuides: true,
    viewportHudVisible: false,
  };
}

function readUiPresetFromUrl(): UiPreset {
  if (typeof window === "undefined") {
    return "figjam";
  }

  const value = new URLSearchParams(window.location.search).get("ui");
  return value === "classic" ? "classic" : "figjam";
}

function writeUiPresetToUrl(preset: UiPreset): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (preset === "classic") {
    url.searchParams.set("ui", "classic");
  } else {
    url.searchParams.delete("ui");
  }
  window.history.replaceState(null, "", url.toString());
}
