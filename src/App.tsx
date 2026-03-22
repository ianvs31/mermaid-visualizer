import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStart,
  type OnNodesChange,
  type OnReconnect,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { deriveNodePaint, resolveNodeAppearance } from "./app/appearance";
import { pickAutoHandle, validateConnection } from "./app/connection";
import { copyExportToClipboard, type ExportFormat } from "./app/export";
import { buildHiddenGroupIds, isGroupVisible } from "./app/group-visibility";
import { ImportDrawioError, importDrawioXml } from "./app/import-drawio";
import { getDefaultNodeSize } from "./app/node-geometry";
import { getPaletteItem, type PaletteItemId } from "./app/palette";
import { QUICK_CONNECT_EVENT, type QuickConnectEventDetail } from "./app/quick-connect-events";
import { applyFlowNodePosition, modelToFlowElements } from "./app/reactflow-mapper";
import { useAutoApplyCode } from "./hooks/useAutoApplyCode";
import { useEditorPersistence } from "./hooks/useEditorPersistence";
import { useMermaidPreview } from "./hooks/useMermaidPreview";
import { summarizeNodeAppearances } from "./app/selection-appearance";
import {
  isApplyCodeShortcut,
  isArmedInlineProxyTarget,
  isCenterViewportShortcut,
  isCopyShortcut,
  isCutShortcut,
  isFitViewShortcut,
  isInputLike,
  isPasteShortcut,
  isRedoShortcut,
  isResetViewportShortcut,
  isUndoShortcut,
  pickToolModeFromShortcut,
} from "./app/shortcuts";
import { useEditorStore } from "./app/store";
import type {
  DiagramGroup,
  DiagramNode,
  EdgeHandlePosition,
  InlineEditSession,
  NodeAppearance,
  QuickConnectDirection,
  ToolMode,
} from "./app/types";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ContextToolbar } from "./components/ContextToolbar";
import { EdgeContextToolbar } from "./components/EdgeContextToolbar";
import { InlineTextOverlay, type InlineArmedTarget, type InlineOverlayRect } from "./components/InlineTextOverlay";
import { FlowNode, GroupNode } from "./components/nodes";
import { PaletteDragPreview } from "./components/PaletteDragPreview";
import { QuickCreatePopover } from "./components/QuickCreatePopover";
import { Toast } from "./components/Toast";
import { ViewportHud } from "./components/ViewportHud";
import { ViewportControls } from "./components/ViewportControls";
import "./styles/app.css";

const NODE_TYPES = {
  flowNode: FlowNode,
  groupNode: GroupNode,
};

const EMPTY_GUIDES: AlignmentGuides = { vertical: [], horizontal: [] };

function EditorApp() {
  const {
    model,
    code,
    codeDirty,
    warnings,
    message,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    inlineEditSession,
    zoom,
    persistenceReady,
    toastTick,
    interaction,
    init,
    setZoom,
    setCode,
    notify,
    setToolMode,
    toggleSnap,
    setViewportHudVisible,
    applyCodeToModel,
    syncCodeFromModel,
    replaceModel,
    newDocument,
    openMermaidText,
    downloadExport,
    beginInlineEdit,
    endInlineEdit,
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteClipboard,
    addNode,
    addSwimlane,
    assignSelectionToGroup,
    toggleGroupCollapse,
    updateNodeGeometry,
    updateNodeParentGroup,
    updateGroupGeometry,
    upsertEdge,
    startEdgeReconnect,
    finishEdgeReconnect,
    updateSelectedNodeAppearance,
    commitNodeLabel,
    commitGroupTitle,
    updateEdgeLabel,
    updateEdgeStrokePattern,
    setSelection,
    deleteSelection,
    autoLayout,
    pendingRenderTick,
    fitViewTick,
  } = useEditorStore();
  useEditorPersistence(useMemo(() => ({ code, model, codeDirty }), [code, codeDirty, model]), persistenceReady);
  const { previewSvg, previewError } = useMermaidPreview(code, pendingRenderTick);
  const [spacePressed, setSpacePressed] = useState(false);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [edgeEditor, setEdgeEditor] = useState<{ edgeId: string; value: string } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>(EMPTY_GUIDES);
  const [laneDrawArmed, setLaneDrawArmed] = useState(false);
  const [laneDraft, setLaneDraft] = useState<LaneDraft | null>(null);
  const [paletteDragSession, setPaletteDragSession] = useState<PaletteDragSession | null>(null);
  const [quickCreateSession, setQuickCreateSession] = useState<QuickCreateSession | null>(null);
  const [contextToolbarPopoverOpen, setContextToolbarPopoverOpen] = useState(false);
  const [viewport, setViewportState] = useState({ x: 0, y: 0, zoom: 1 });

  const edgeEditorInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const laneDraftRef = useRef<LaneDraft | null>(null);
  const previousRightPanelOpenRef = useRef(rightPanelOpen);
  const handledFitViewTickRef = useRef(0);
  const dragSnapRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  const paletteDragRef = useRef<PaletteDragSession | null>(null);
  const suppressPaletteClickRef = useRef<PaletteItemId | null>(null);
  const deferredSelectionFrameRef = useRef<number | null>(null);

  const { fitView, zoomIn, zoomOut, setViewport, screenToFlowPosition } = useReactFlow();
  const fitViewRef = useRef(fitView);
  const isClassicPreset = interaction.uiPreset === "classic";
  const effectiveToolMode: ToolMode = isClassicPreset ? "select" : interaction.toolMode;

  const handleQuickConnect = useCallback(
    (sourceNodeId: string, direction: QuickConnectDirection, anchorClientX: number, anchorClientY: number) => {
      if (effectiveToolMode === "pan") {
        return;
      }

      const sourceNode = model.nodes.find((node) => node.id === sourceNodeId);
      if (!sourceNode) {
        return;
      }

      const nearest = findNearestNodeInDirection(sourceNode, direction, model.nodes);
      if (nearest) {
        const duplicate = model.edges.find((edge) => edge.from === sourceNodeId && edge.to === nearest.id);
        if (duplicate) {
          notify("info", "该连线已存在");
          return;
        }
        const handles = pickAutoHandle(sourceNode, nearest);
        upsertEdge(sourceNodeId, nearest.id, "", handles.sourceHandle, handles.targetHandle);
        setQuickCreateSession(null);
        return;
      }

      setQuickCreateSession({
        sourceNodeId,
        direction,
        sourceHandle: direction,
        anchorClientX,
        anchorClientY,
      });
    },
    [effectiveToolMode, model.edges, model.nodes, notify, upsertEdge],
  );

  useEffect(() => {
    const onQuickConnectEvent = (event: Event) => {
      const detail = (event as CustomEvent<QuickConnectEventDetail>).detail;
      if (!detail) {
        return;
      }
      handleQuickConnect(detail.nodeId, detail.direction, detail.anchorClientX, detail.anchorClientY);
    };

    window.addEventListener(QUICK_CONNECT_EVENT, onQuickConnectEvent as EventListener);
    return () => window.removeEventListener(QUICK_CONNECT_EVENT, onQuickConnectEvent as EventListener);
  }, [handleQuickConnect]);

  const elements = useMemo(
    () =>
      modelToFlowElements(model, {
        toolMode: effectiveToolMode,
        selectedNodeIds,
        selectedEdgeIds,
        selectedGroupIds,
        connectingNodeId,
        onGroupResizeEnd: (groupId, width, height) => {
          const current = model.groups.find((group) => group.id === groupId);
          if (!current) {
            return;
          }
          updateGroupGeometry(groupId, current.x, current.y, width, height, true);
          syncCodeFromModel();
        },
        onToggleGroupCollapse: toggleGroupCollapse,
      }),
    [
      connectingNodeId,
      effectiveToolMode,
      model,
      selectedEdgeIds,
      selectedGroupIds,
      selectedNodeIds,
      syncCodeFromModel,
      toggleGroupCollapse,
      updateGroupGeometry,
    ],
  );

  const flowNodeMap = useMemo(() => new Map(elements.nodes.map((node) => [node.id, node])), [elements.nodes]);
  const groupMap = useMemo(() => new Map(model.groups.map((group) => [group.id, group])), [model.groups]);

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1 || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0) {
      return null;
    }
    return model.nodes.find((item) => item.id === selectedNodeIds[0]) ?? null;
  }, [model.nodes, selectedEdgeIds.length, selectedGroupIds.length, selectedNodeIds]);

  const selectedNodes = useMemo(
    () => model.nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [model.nodes, selectedNodeIds],
  );

  const selectedGroup = useMemo(() => {
    if (selectedGroupIds.length !== 1) {
      return null;
    }

    return model.groups.find((group) => group.id === selectedGroupIds[0]) ?? null;
  }, [model.groups, selectedGroupIds]);

  const selectedEdge = useMemo(() => {
    if (selectedEdgeIds.length !== 1 || selectedNodeIds.length > 0 || selectedGroupIds.length > 0) {
      return null;
    }

    return model.edges.find((edge) => edge.id === selectedEdgeIds[0]) ?? null;
  }, [model.edges, selectedEdgeIds, selectedGroupIds.length, selectedNodeIds.length]);

  const selectedNodeAppearance = useMemo<NodeAppearance | null>(
    () => (selectedNode ? resolveNodeAppearance(selectedNode) : null),
    [selectedNode],
  );

  const selectedNodePaint = useMemo(
    () => (selectedNodeAppearance ? deriveNodePaint(selectedNodeAppearance) : null),
    [selectedNodeAppearance],
  );

  const selectionAppearanceSummary = useMemo(
    () =>
      selectedNodeIds.length >= 2 && selectedEdgeIds.length === 0 && selectedGroupIds.length === 0
        ? summarizeNodeAppearances(selectedNodes)
        : null,
    [selectedEdgeIds.length, selectedGroupIds.length, selectedNodeIds.length, selectedNodes],
  );

  const selectedNodeBoxes = useMemo(() => selectedNodes.map((node) => toNodeBox(node)), [selectedNodes]);

  const multiNodeBounds = useMemo(() => {
    if (selectedNodeBoxes.length < 2) {
      return null;
    }
    return getBoundingBox(selectedNodeBoxes);
  }, [selectedNodeBoxes]);

  const contextAnchor = useMemo(() => {
    if (selectedNode && selectedNodePaint) {
      const rect = toScreenRect(toNodeBox(selectedNode), viewport);
      return {
        mode: "single" as const,
        x: rect.x + rect.width / 2,
        y: rect.y - 18,
      };
    }
    if (multiNodeBounds && selectionAppearanceSummary) {
      const rect = toScreenRect(multiNodeBounds, viewport);
      return {
        mode: "multi" as const,
        x: rect.x + rect.width / 2,
        y: rect.y - 18,
      };
    }
    return null;
  }, [multiNodeBounds, selectedNode, selectedNodePaint, selectionAppearanceSummary, viewport]);

  const canAssignSelectionToGroup =
    effectiveToolMode === "select" &&
    !!selectedGroup &&
    selectedNodeIds.length > 0 &&
    selectedEdgeIds.length === 0 &&
    !inlineEditSession &&
    !edgeEditor &&
    !quickCreateSession &&
    !laneDrawArmed &&
    !laneDraft;

  const groupActionAnchor = useMemo(() => {
    if (!canAssignSelectionToGroup || !selectedGroup) {
      return null;
    }

    const rect = toScreenRect(selectedGroup, viewport);
    return {
      x: rect.x + rect.width / 2,
      y: rect.y - 18,
    };
  }, [canAssignSelectionToGroup, selectedGroup, viewport]);

  const edgeContextAnchor = useMemo(() => {
    if (!selectedEdge) {
      return null;
    }

    const sourceNode = model.nodes.find((node) => node.id === selectedEdge.from);
    const targetNode = model.nodes.find((node) => node.id === selectedEdge.to);
    if (!sourceNode || !targetNode) {
      return null;
    }

    const sourcePoint = getEdgeHandleAnchor(toNodeBox(sourceNode), selectedEdge.sourceHandle ?? "right");
    const targetPoint = getEdgeHandleAnchor(toNodeBox(targetNode), selectedEdge.targetHandle ?? "left");
    const midpoint = {
      x: (sourcePoint.x + targetPoint.x) / 2,
      y: (sourcePoint.y + targetPoint.y) / 2,
    };

    return {
      x: viewport.x + midpoint.x * viewport.zoom,
      y: viewport.y + midpoint.y * viewport.zoom - 18,
    };
  }, [model.nodes, selectedEdge, viewport.x, viewport.y, viewport.zoom]);

  const quickCreatePopoverAnchor = useMemo(() => {
    if (!quickCreateSession || !workspaceRef.current) {
      return null;
    }

    return clampQuickCreatePopoverAnchor(
      quickCreateSession.anchorClientX,
      quickCreateSession.anchorClientY,
      workspaceRef.current.getBoundingClientRect(),
    );
  }, [quickCreateSession]);

  const inlineTargetRect = useMemo<InlineOverlayRect | null>(() => {
    if (!inlineEditSession) {
      return null;
    }
    if (inlineEditSession.targetType === "node") {
      const node = model.nodes.find((item) => item.id === inlineEditSession.targetId);
      return node ? { targetType: "node", ...toScreenRect(toNodeBox(node), viewport) } : null;
    }
    const group = model.groups.find((item) => item.id === inlineEditSession.targetId);
    return group ? { targetType: "group", ...toScreenRect(group, viewport) } : null;
  }, [inlineEditSession, model.groups, model.nodes, viewport]);

  const armedRenameTarget = useMemo<InlineArmedTarget | null>(() => {
    if (
      effectiveToolMode !== "select" ||
      !!inlineEditSession ||
      !!edgeEditor ||
      !!quickCreateSession ||
      contextToolbarPopoverOpen ||
      laneDrawArmed ||
      !!laneDraft ||
      selectedEdgeIds.length > 0 ||
      selectedGroupIds.length > 0 ||
      selectedNodeIds.length !== 1 ||
      !selectedNode
    ) {
      return null;
    }

    return {
      targetType: "node",
      targetId: selectedNode.id,
      label: selectedNode.label,
      rect: { targetType: "node", ...toScreenRect(toNodeBox(selectedNode), viewport) },
    };
  }, [
    edgeEditor,
    contextToolbarPopoverOpen,
    effectiveToolMode,
    inlineEditSession,
    laneDraft,
    laneDrawArmed,
    quickCreateSession,
    selectedEdgeIds.length,
    selectedGroupIds.length,
    selectedNode,
    selectedNodeIds.length,
    viewport,
  ]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return () => {
      if (deferredSelectionFrameRef.current !== null) {
        window.cancelAnimationFrame(deferredSelectionFrameRef.current);
      }
    };
  }, []);

  const queueSelection = useCallback(
    (nodeIds: string[], edgeIds: string[], groupIds: string[]) => {
      if (deferredSelectionFrameRef.current !== null) {
        window.cancelAnimationFrame(deferredSelectionFrameRef.current);
      }

      deferredSelectionFrameRef.current = window.requestAnimationFrame(() => {
        deferredSelectionFrameRef.current = null;
        setSelection(nodeIds, edgeIds, groupIds);
      });
    },
    [setSelection],
  );

  useAutoApplyCode(code, codeDirty, applyCodeToModel);

  useEffect(() => {
    if (!fitViewTick || fitViewTick === handledFitViewTickRef.current || elements.nodes.length === 0) {
      return;
    }

    handledFitViewTickRef.current = fitViewTick;
    const raf = window.requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 220 });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [elements.nodes.length, fitView, fitViewTick]);

  useEffect(() => {
    fitViewRef.current = fitView;
  }, [fitView]);

  useEffect(() => {
    previousRightPanelOpenRef.current = rightPanelOpen;
  }, [rightPanelOpen]);

  useEffect(() => {
    setShowToast(true);
    const timer = window.setTimeout(() => setShowToast(false), 1800);
    return () => window.clearTimeout(timer);
  }, [toastTick]);

  useEffect(() => {
    setViewportHudVisible(true);
    const timer = window.setTimeout(() => setViewportHudVisible(false), 600);
    return () => window.clearTimeout(timer);
  }, [setViewportHudVisible, zoom]);

  useEffect(() => {
    if (!edgeEditor) {
      return;
    }
    edgeEditorInputRef.current?.focus();
    edgeEditorInputRef.current?.select();
  }, [edgeEditor]);

  useEffect(() => {
    laneDraftRef.current = laneDraft;
  }, [laneDraft]);

  useEffect(() => {
    paletteDragRef.current = paletteDragSession;
  }, [paletteDragSession]);

  useEffect(() => {
    if (!contextAnchor) {
      setContextToolbarPopoverOpen(false);
    }
  }, [contextAnchor]);

  const cancelLaneDrawing = useCallback(
    (reason?: string) => {
      setLaneDraft(null);
      laneDraftRef.current = null;
      setLaneDrawArmed(false);
      if (reason) {
        notify("info", reason);
      }
    },
    [notify],
  );

  const completeLaneDrawing = useCallback(
    (clientX: number, clientY: number) => {
      const draft = laneDraftRef.current;
      if (!draft) {
        return;
      }

      const start = screenToFlowPosition({
        x: draft.startClientX,
        y: draft.startClientY,
      });
      const end = screenToFlowPosition({ x: clientX, y: clientY });
      const bounds = normalizeDraftBounds(start, end);

      setLaneDraft(null);
      laneDraftRef.current = null;

      if (bounds.width < 96 || bounds.height < 80) {
        notify("info", "拖拽范围过小，未创建泳道");
        return;
      }

      addSwimlane(pickLaneOrientation(bounds.width, bounds.height), bounds);
      setLaneDrawArmed(false);
    },
    [addSwimlane, notify, screenToFlowPosition],
  );

  useEffect(() => {
    if (!laneDraft) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      setLaneDraft((prev) =>
        prev
          ? {
              ...prev,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
            }
          : prev,
      );
    };

    const onMouseUp = (event: MouseEvent) => {
      completeLaneDrawing(event.clientX, event.clientY);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [completeLaneDrawing, laneDraft !== null]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inInput = isInputLike(event.target);

      if (event.code === "Space") {
        setSpacePressed(true);
      }

      if (event.key === "Escape") {
        if (quickCreateSession) {
          event.preventDefault();
          setQuickCreateSession(null);
          return;
        }
        if (laneDraftRef.current || laneDrawArmed) {
          event.preventDefault();
          cancelLaneDrawing("已取消泳道绘制");
          return;
        }
        if (!inInput) {
          setEdgeEditor(null);
          endInlineEdit();
        }
      }

      if (!inInput && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (!inInput && isUndoShortcut(event)) {
        event.preventDefault();
        undo();
        return;
      }

      if (!inInput && isRedoShortcut(event)) {
        event.preventDefault();
        redo();
        return;
      }

      if (!inInput && isCopyShortcut(event)) {
        event.preventDefault();
        copySelection();
        return;
      }

      if (!inInput && isCutShortcut(event)) {
        event.preventDefault();
        cutSelection();
        return;
      }

      if (!inInput && isPasteShortcut(event)) {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (isApplyCodeShortcut(event)) {
        event.preventDefault();
        void applyCodeToModel({ fitView: true });
        return;
      }

      if (!inInput && isFitViewShortcut(event)) {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 220 });
        return;
      }

      if (!inInput && isCenterViewportShortcut(event)) {
        event.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
        return;
      }

      if (isResetViewportShortcut(event)) {
        event.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
        return;
      }

      if (isArmedInlineProxyTarget(event.target)) {
        return;
      }

      if (!inInput && armedRenameTarget && isPrintableKey(event)) {
        event.preventDefault();
        setEdgeEditor(null);
        beginInlineEdit({
          targetType: armedRenameTarget.targetType,
          targetId: armedRenameTarget.targetId,
          initialValue: event.key,
          sessionId: `type-${armedRenameTarget.targetType}-${armedRenameTarget.targetId}-${Date.now()}`,
          source: "type-to-rename",
          replaceMode: "replaceAll",
        });
        return;
      }

      if (inInput || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const mode = pickToolModeFromShortcut(event);
      if (mode) {
        event.preventDefault();
        setToolMode(mode);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    applyCodeToModel,
    cancelLaneDrawing,
    copySelection,
    cutSelection,
    deleteSelection,
    fitView,
    laneDrawArmed,
    pasteClipboard,
    quickCreateSession,
    redo,
    setToolMode,
    setViewport,
    undo,
    armedRenameTarget,
    beginInlineEdit,
    endInlineEdit,
  ]);

  const resolveHandlePair = useCallback(
    (connection: Pick<Connection, "source" | "target" | "sourceHandle" | "targetHandle">) => {
      const sourceNode = model.nodes.find((node) => node.id === connection.source);
      const targetNode = model.nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) {
        return null;
      }

      const explicitSource = normalizeHandle(connection.sourceHandle);
      const explicitTarget = normalizeHandle(connection.targetHandle);
      if (explicitSource && explicitTarget) {
        return {
          sourceHandle: explicitSource,
          targetHandle: explicitTarget,
        };
      }

      return pickAutoHandle(sourceNode, targetNode);
    },
    [model.nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const result = validateConnection(connection, model);
      if (!result.ok) {
        notify("error", result.reason || "无法创建连线");
        return;
      }

      const handles = resolveHandlePair(connection);
      if (!connection.source || !connection.target || !handles) {
        notify("error", "无法解析连线端口");
        return;
      }

      upsertEdge(connection.source, connection.target, "", handles.sourceHandle, handles.targetHandle);
    },
    [model, notify, resolveHandlePair, upsertEdge],
  );

  const onReconnect = useCallback<OnReconnect<Edge>>(
    (oldEdge, newConnection) => {
      const result = validateConnection(newConnection, model, { ignoreEdgeId: oldEdge.id });
      if (!result.ok) {
        notify("error", result.reason || "无法重连边");
        return;
      }

      const handles = resolveHandlePair(newConnection);
      if (!newConnection.source || !newConnection.target || !handles) {
        notify("error", "无法解析重连端口");
        return;
      }

      finishEdgeReconnect({
        edgeId: oldEdge.id,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
      });
    },
    [finishEdgeReconnect, model, notify, resolveHandlePair],
  );

  const onConnectStart = useCallback<OnConnectStart>((_event, params) => {
    setConnectingNodeId(params.nodeId || null);
  }, []);

  const onConnectEnd = useCallback(() => {
    setConnectingNodeId(null);
  }, []);

  const onNodesChange = useCallback<OnNodesChange<Node>>(
    (changes) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          const isGroup = groupMap.has(change.id);
          const parent = flowNodeMap.get(change.id)?.parentId ? groupMap.get(flowNodeMap.get(change.id)!.parentId!) : undefined;
          const target = isGroup
            ? groupMap.get(change.id)
            : model.nodes.find((node) => node.id === change.id);

          if (!target) {
            continue;
          }

          const absolute = applyFlowNodePosition(target, change.position, parent);
          const normalizedAbsolute = {
            x: roundCanvasValue(absolute.x),
            y: roundCanvasValue(absolute.y),
          };
          if (isGroup) {
            updateGroupGeometry(
              change.id,
              normalizedAbsolute.x,
              normalizedAbsolute.y,
              roundCanvasValue(flowNodeMap.get(change.id)?.width || 320),
              roundCanvasValue(flowNodeMap.get(change.id)?.height || 180),
              false,
            );
          } else {
            updateNodeGeometry(
              change.id,
              normalizedAbsolute.x,
              normalizedAbsolute.y,
              flowNodeMap.get(change.id)?.width ? roundCanvasValue(flowNodeMap.get(change.id)!.width!) : undefined,
              flowNodeMap.get(change.id)?.height ? roundCanvasValue(flowNodeMap.get(change.id)!.height!) : undefined,
              false,
            );
          }
          continue;
        }

        if (change.type === "dimensions" && change.dimensions) {
          const isGroup = groupMap.has(change.id);
          if (!isGroup) {
            continue;
          }
          const flowNode = flowNodeMap.get(change.id);
          if (!flowNode) {
            continue;
          }

          const parent = flowNode.parentId ? groupMap.get(flowNode.parentId) : undefined;
          const absolute = applyFlowNodePosition(
            isGroup ? (groupMap.get(change.id) as DiagramGroup) : model.nodes.find((node) => node.id === change.id)!,
            flowNode.position,
            parent,
          );
          const normalizedAbsolute = {
            x: roundCanvasValue(absolute.x),
            y: roundCanvasValue(absolute.y),
          };
          const normalizedDimensions = {
            width: roundCanvasValue(change.dimensions.width),
            height: roundCanvasValue(change.dimensions.height),
          };

          if (isGroup) {
            updateGroupGeometry(
              change.id,
              normalizedAbsolute.x,
              normalizedAbsolute.y,
              normalizedDimensions.width,
              normalizedDimensions.height,
            );
          }
        }
      }
    },
    [flowNodeMap, groupMap, model.nodes, updateGroupGeometry, updateNodeGeometry],
  );

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!interaction.showAlignmentGuides) {
        dragSnapRef.current = { x: null, y: null };
        return;
      }
      if (groupMap.has(node.id)) {
        dragSnapRef.current = { x: null, y: null };
        setAlignmentGuides(EMPTY_GUIDES);
        return;
      }

      const parent = node.parentId ? groupMap.get(node.parentId) : undefined;
      const nodeWidth = node.width || 148;
      const nodeHeight = node.height || 72;
      const absolute = parent ? { x: parent.x + node.position.x, y: parent.y + node.position.y } : node.position;

      const snap = calculateAlignmentSnap(
        {
          id: node.id,
          x: absolute.x,
          y: absolute.y,
          width: nodeWidth,
          height: nodeHeight,
        },
        model.nodes,
      );

      dragSnapRef.current = { x: snap.snappedX, y: snap.snappedY };
      setAlignmentGuides(snap.guides);
    },
    [groupMap, interaction.showAlignmentGuides, model.nodes],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const isGroup = groupMap.has(node.id);
      const parent = node.parentId ? groupMap.get(node.parentId) : undefined;

      const absolute = applyFlowNodePosition(
        isGroup ? (groupMap.get(node.id) as DiagramGroup) : model.nodes.find((n) => n.id === node.id)!,
        node.position,
        parent,
      );

      if (isGroup) {
        updateGroupGeometry(node.id, absolute.x, absolute.y, node.width || 320, node.height || 180, true);
      } else {
        const nextX = dragSnapRef.current.x ?? absolute.x;
        const nextY = dragSnapRef.current.y ?? absolute.y;
        const normalizedNextX = roundCanvasValue(nextX);
        const normalizedNextY = roundCanvasValue(nextY);
        const currentNode = model.nodes.find((item) => item.id === node.id);
        const nextParentGroupId = currentNode
          ? findContainingGroupId(
              {
                id: currentNode.id,
                x: normalizedNextX,
                y: normalizedNextY,
                width: roundCanvasValue(node.width || currentNode.width || 148),
                height: roundCanvasValue(node.height || currentNode.height || 72),
              },
              model.groups,
            )
          : undefined;

        updateNodeGeometry(
          node.id,
          normalizedNextX,
          normalizedNextY,
          node.width ? roundCanvasValue(node.width) : undefined,
          node.height ? roundCanvasValue(node.height) : undefined,
          true,
        );
        updateNodeParentGroup(node.id, nextParentGroupId, false);
      }
      dragSnapRef.current = { x: null, y: null };
      setAlignmentGuides(EMPTY_GUIDES);
      syncCodeFromModel();
    },
    [groupMap, model.groups, model.nodes, syncCodeFromModel, updateGroupGeometry, updateNodeGeometry, updateNodeParentGroup],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (groupMap.has(node.id)) {
        const currentGroup = model.groups.find((group) => group.id === node.id);
        if (!currentGroup) {
          return;
        }
        setEdgeEditor(null);
        beginInlineEdit({
          targetType: "group",
          targetId: node.id,
          initialValue: currentGroup.title,
          sessionId: `group-${node.id}-${Date.now()}`,
          source: "double-click",
          replaceMode: "preserve",
        });
        return;
      }

      const current = model.nodes.find((item) => item.id === node.id);
      if (!current) {
        return;
      }
      setEdgeEditor(null);
      beginInlineEdit({
        targetType: "node",
        targetId: node.id,
        initialValue: current.label,
        sessionId: `node-${node.id}-${Date.now()}`,
        source: "double-click",
        replaceMode: "preserve",
      });
    },
    [beginInlineEdit, groupMap, model.groups, model.nodes],
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const current = model.edges.find((item) => item.id === edge.id);
      if (!current) {
        return;
      }
      endInlineEdit();
      setEdgeEditor({ edgeId: edge.id, value: current.label || "" });
    },
    [endInlineEdit, model.edges],
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const nodeIds: string[] = [];
      const groupIds: string[] = [];

      for (const node of nodes) {
        if (groupMap.has(node.id)) {
          groupIds.push(node.id);
        } else {
          nodeIds.push(node.id);
        }
      }

      setSelection(nodeIds, edges.map((edge) => edge.id), groupIds);
    },
    [groupMap, setSelection],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const isGroup = groupMap.has(node.id);
      if (event.shiftKey) {
        setSelection(
          isGroup ? selectedNodeIds : toggleSelectionId(selectedNodeIds, node.id),
          selectedEdgeIds,
          isGroup ? toggleSelectionId(selectedGroupIds, node.id) : selectedGroupIds,
        );
        return;
      }

      setSelection(isGroup ? [] : [node.id], [], isGroup ? [node.id] : []);
    },
    [groupMap, selectedEdgeIds, selectedGroupIds, selectedNodeIds, setSelection],
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (event.shiftKey) {
        setSelection(selectedNodeIds, toggleSelectionId(selectedEdgeIds, edge.id), selectedGroupIds);
        return;
      }
      setSelection([], [edge.id], []);
    },
    [selectedEdgeIds, selectedGroupIds, selectedNodeIds, setSelection],
  );

  const onMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
      setZoom(viewport.zoom);
      setViewportState(viewport);
    },
    [setZoom],
  );

  const flowCursor = laneDrawArmed || laneDraft ? "crosshair" : spacePressed || effectiveToolMode === "pan" ? "grab" : "default";

  const handlePaneClick = useCallback(
    (_event: React.MouseEvent) => {
      if (edgeEditor) {
        setEdgeEditor(null);
      }
      endInlineEdit();
      setQuickCreateSession(null);

      setSelection([], [], []);
    },
    [edgeEditor, endInlineEdit, setSelection],
  );

  const commitEdgeLabel = useCallback(() => {
    if (!edgeEditor) {
      return;
    }
    updateEdgeLabel(edgeEditor.edgeId, edgeEditor.value.trim());
    setEdgeEditor(null);
  }, [edgeEditor, updateEdgeLabel]);

  const createPaletteItemAtPosition = useCallback(
    (itemId: PaletteItemId, center: { x: number; y: number }) => {
      const item = getPaletteItem(itemId);
      if (item.kind === "group") {
        const bounds = {
          x: roundCanvasValue(center.x - item.defaultSize.width / 2),
          y: roundCanvasValue(center.y - item.defaultSize.height / 2),
          width: item.defaultSize.width,
          height: item.defaultSize.height,
        };
        const groupId = addSwimlane(pickLaneOrientation(bounds.width, bounds.height), bounds);
        queueSelection([], [], [groupId]);
        return { nodeId: undefined, groupId };
      }

      const width = item.defaultSize.width;
      const height = item.defaultSize.height;
      const x = roundCanvasValue(center.x - width / 2);
      const y = roundCanvasValue(center.y - height / 2);
      const parentGroupId = findContainingGroupId(
        {
          id: "__preview__",
          x,
          y,
          width,
          height,
        },
        model.groups,
      );
      const nodeId = addNode(item.createNodeType ?? "process", { x, y }, parentGroupId);
      queueSelection([nodeId], [], []);
      return { nodeId, groupId: undefined };
    },
    [addNode, addSwimlane, model.groups, queueSelection],
  );

  const activatePaletteItem = useCallback(
    (itemId: PaletteItemId) => {
      if (suppressPaletteClickRef.current === itemId) {
        suppressPaletteClickRef.current = null;
        return;
      }

      if (itemId === "swimlane") {
        if (laneDrawArmed || laneDraft) {
          cancelLaneDrawing("已取消泳道绘制");
          return;
        }
        setToolMode("select");
        setLaneDrawArmed(true);
        notify("info", "在画布上拖拽以创建泳道");
        return;
      }

      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const point = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2 - 40,
      });
      createPaletteItemAtPosition(itemId, point);
    },
    [
      cancelLaneDrawing,
      createPaletteItemAtPosition,
      laneDraft,
      laneDrawArmed,
      notify,
      screenToFlowPosition,
      setToolMode,
    ],
  );

  const handlePalettePointerDown = useCallback(
    (itemId: PaletteItemId, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      paletteDragRef.current = {
        itemId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        active: false,
        overCanvas: false,
      };
      setPaletteDragSession(paletteDragRef.current);
    },
    [],
  );

  const completeQuickCreate = useCallback(
    (itemId: PaletteItemId) => {
      if (!quickCreateSession) {
        return;
      }
      const sourceNode = model.nodes.find((node) => node.id === quickCreateSession.sourceNodeId);
      if (!sourceNode) {
        setQuickCreateSession(null);
        return;
      }

      const placement = getQuickCreatePlacement(sourceNode, quickCreateSession.direction, itemId);
      const created = createPaletteItemAtPosition(itemId, placement.center);
      if (created.nodeId) {
        upsertEdge(
          quickCreateSession.sourceNodeId,
          created.nodeId,
          "",
          quickCreateSession.sourceHandle,
          oppositeHandle(quickCreateSession.sourceHandle),
        );
      }
      setQuickCreateSession(null);
    },
    [createPaletteItemAtPosition, model.groups, model.nodes, quickCreateSession, upsertEdge],
  );

  const handleCopyExport = useCallback(
    async (format: ExportFormat) => {
      try {
        await copyExportToClipboard(format, model);
        notify(
          "success",
          format === "drawio-xml"
            ? "已复制 draw.io XML"
            : format === "editor-json"
              ? "已复制 JSON"
              : "已复制 Markdown",
        );
      } catch {
        notify("error", "复制失败，请检查浏览器剪贴板权限");
      }
    },
    [model, notify],
  );

  const confirmReplaceDiagram = useCallback(() => {
    const hasContent =
      codeDirty ||
      model.nodes.length > 0 ||
      model.edges.length > 0 ||
      model.groups.length > 0 ||
      model.rawPassthroughStatements.length > 0;

    if (!hasContent) {
      return true;
    }

    return window.confirm("当前图表将被覆盖，是否继续？");
  }, [codeDirty, model.edges.length, model.groups.length, model.nodes.length, model.rawPassthroughStatements.length]);

  const handleNewDocument = useCallback(() => {
    if (!confirmReplaceDiagram()) {
      return;
    }
    newDocument();
  }, [confirmReplaceDiagram, newDocument]);

  const handleOpenMermaidFile = useCallback(
    async (file: File) => {
      if (!confirmReplaceDiagram()) {
        return;
      }

      try {
        await openMermaidText(await file.text());
      } catch {
        notify("error", "读取 Mermaid 文件失败");
      }
    },
    [confirmReplaceDiagram, notify, openMermaidText],
  );

  const handleImportXmlText = useCallback(
    (xmlText: string) => {
      if (!confirmReplaceDiagram()) {
        return;
      }

      const trimmed = xmlText.trim();
      if (!trimmed) {
        notify("error", "XML 内容为空，导入已取消");
        return;
      }

      try {
        const imported = importDrawioXml(trimmed);
        const message =
          imported.warnings.length > 0
            ? `已导入 XML（${imported.warnings[0]}）`
            : "已导入 XML";
        replaceModel(imported.model, message);
        window.requestAnimationFrame(() => {
          fitView({ padding: 0.2, duration: 220 });
        });
      } catch (error) {
        if (error instanceof ImportDrawioError) {
          notify("error", error.message);
          return;
        }
        notify("error", "导入 XML 失败，请检查内容格式");
      }
    },
    [confirmReplaceDiagram, fitView, notify, replaceModel],
  );

  const handleImportXmlFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        handleImportXmlText(text);
      } catch {
        notify("error", "读取 XML 文件失败");
      }
    },
    [handleImportXmlText, notify],
  );

  useEffect(() => {
    if (!paletteDragSession) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      setPaletteDragSession((prev) => {
        if (!prev) {
          return prev;
        }
        const dx = event.clientX - prev.startClientX;
        const dy = event.clientY - prev.startClientY;
        const workspaceRect = workspaceRef.current?.getBoundingClientRect();
        const overCanvas = workspaceRect
          ? event.clientX >= workspaceRect.left &&
            event.clientX <= workspaceRect.right &&
            event.clientY >= workspaceRect.top &&
            event.clientY <= workspaceRect.bottom
          : false;
        return {
          ...prev,
          pointerClientX: event.clientX,
          pointerClientY: event.clientY,
          active: prev.active || Math.hypot(dx, dy) > 6,
          overCanvas,
        };
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const session = paletteDragRef.current;
      setPaletteDragSession(null);
      paletteDragRef.current = null;

      if (!session?.active) {
        return;
      }

      suppressPaletteClickRef.current = session.itemId;
      window.setTimeout(() => {
        suppressPaletteClickRef.current = null;
      }, 0);

      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      if (!workspaceRect) {
        return;
      }

      if (
        event.clientX < workspaceRect.left ||
        event.clientX > workspaceRect.right ||
        event.clientY < workspaceRect.top ||
        event.clientY > workspaceRect.bottom
      ) {
        return;
      }

      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      createPaletteItemAtPosition(session.itemId, point);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [createPaletteItemAtPosition, paletteDragSession, screenToFlowPosition]);

  const onEdgeEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdgeLabel();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setEdgeEditor(null);
      }
    },
    [commitEdgeLabel],
  );

  const panOnDrag = spacePressed || effectiveToolMode === "pan" ? [0, 1, 2] : [1, 2];
  const nodesDraggable = effectiveToolMode !== "pan";
  const nodesConnectable = effectiveToolMode === "select";

  return (
    <div className={`app-shell figjam-shell ${rightPanelOpen ? "app-shell--right-open" : "app-shell--right-closed"}`}>
      <main ref={workspaceRef} className="workspace" style={{ cursor: flowCursor }}>
        <ReactFlow
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={NODE_TYPES}
          minZoom={0.25}
          maxZoom={3}
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnDrag={panOnDrag}
          panActivationKeyCode={["Space"]}
          connectOnClick={false}
          deleteKeyCode={null}
          onMove={onMove}
          onPaneClick={handlePaneClick}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onReconnectStart={(_event, edge, handleType) => startEdgeReconnect(edge.id, handleType)}
          onReconnectEnd={onConnectEnd}
          onNodesChange={onNodesChange}
          onSelectionChange={onSelectionChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={nodesDraggable}
          nodesConnectable={nodesConnectable}
          edgesReconnectable
          selectionOnDrag={isClassicPreset ? true : effectiveToolMode === "select"}
          snapToGrid={interaction.snapToGrid}
          snapGrid={interaction.snapGrid}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.6} color="rgba(15,23,42,0.16)" />

          <ViewportPortal>
            {alignmentGuides.vertical.map((x) => (
              <div key={`vx-${x}`} className="alignment-guide alignment-guide--vertical" style={{ left: x }} />
            ))}
            {alignmentGuides.horizontal.map((y) => (
              <div key={`hy-${y}`} className="alignment-guide alignment-guide--horizontal" style={{ top: y }} />
            ))}
          </ViewportPortal>
        </ReactFlow>

        {!isClassicPreset && contextAnchor && ((contextAnchor.mode === "single" && selectedNodeAppearance && selectedNodePaint) || (contextAnchor.mode === "multi" && selectionAppearanceSummary)) ? (
          <ContextToolbar
            visible
            x={contextAnchor.x}
            y={contextAnchor.y}
            mode={contextAnchor.mode}
            appearance={contextAnchor.mode === "single" ? selectedNodeAppearance! : selectionAppearanceSummary!}
            paint={contextAnchor.mode === "single" ? selectedNodePaint! : undefined}
            disabled={codeDirty && warnings.length > 0}
            onDisabledIntent={() => notify("error", "代码存在未解析更改，修复后再编辑样式")}
            onPopoverOpenChange={setContextToolbarPopoverOpen}
            onSetFillColor={(fillColor) => updateSelectedNodeAppearance({ fillColor })}
            onSetStrokeColor={(strokeColor) => updateSelectedNodeAppearance({ strokeColor })}
            onSetFillMode={(fillMode) => updateSelectedNodeAppearance({ fillMode })}
            onSetStrokePattern={(strokePattern) => updateSelectedNodeAppearance({ strokePattern })}
          />
        ) : null}

        {!isClassicPreset && groupActionAnchor ? (
          <div
            className="figjam-toolbar figjam-toolbar--context"
            style={{ left: groupActionAnchor.x, top: groupActionAnchor.y }}
            role="toolbar"
            aria-label="分区操作"
            onPointerDown={stopUiEvent}
            onMouseDown={stopUiEvent}
            onClick={stopUiEvent}
          >
            <button
              type="button"
              className="context-trigger"
              aria-label="移入当前分区"
              onPointerDown={stopUiEvent}
              onMouseDown={stopUiEvent}
              onClick={(event) => {
                stopUiEvent(event);
                assignSelectionToGroup();
              }}
            >
              <span className="context-trigger__label">移入当前分区</span>
            </button>
          </div>
        ) : null}

        {!isClassicPreset && edgeContextAnchor && selectedEdge && !edgeEditor ? (
          <EdgeContextToolbar
            visible
            x={edgeContextAnchor.x}
            y={edgeContextAnchor.y}
            strokePattern={selectedEdge.strokePattern}
            onEditLabel={() => {
              endInlineEdit();
              setEdgeEditor({ edgeId: selectedEdge.id, value: selectedEdge.label || "" });
            }}
            onSetStrokePattern={(strokePattern) => updateEdgeStrokePattern(selectedEdge.id, strokePattern)}
          />
        ) : null}

        <InlineTextOverlay
          session={inlineEditSession}
          targetRect={inlineTargetRect}
          armedTarget={armedRenameTarget}
          onBeginTypeRename={(target) => {
            const nextSession: InlineEditSession = {
              targetType: target.targetType,
              targetId: target.targetId,
              initialValue: "",
              sessionId: `type-${target.targetType}-${target.targetId}-${Date.now()}`,
              source: "type-to-rename",
              replaceMode: "replaceAll",
            };
            setEdgeEditor(null);
            beginInlineEdit(nextSession);
          }}
          onCommit={(session, value) => {
            if (session.targetType === "node") {
              commitNodeLabel(session.targetId, value);
              return;
            }
            commitGroupTitle(session.targetId, value);
          }}
          onCancel={endInlineEdit}
        />

        {laneDrawArmed ? (
          <div
            className={`lane-draw-overlay${laneDraft ? " is-drawing" : ""}`}
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setSelection([], [], []);
              setEdgeEditor(null);
              endInlineEdit();
              const nextDraft = {
                startClientX: event.clientX,
                startClientY: event.clientY,
                currentClientX: event.clientX,
                currentClientY: event.clientY,
              };
              laneDraftRef.current = nextDraft;
              setLaneDraft(nextDraft);
            }}
          >
            <div className="lane-draw-overlay__hint">拖拽创建泳道区域，按 Esc 取消</div>
            {laneDraft && workspaceRef.current ? (
              <div
                className="lane-draw-overlay__draft"
                style={toLocalDraftStyle(laneDraft, workspaceRef.current.getBoundingClientRect())}
              />
            ) : null}
          </div>
        ) : null}

        {!isClassicPreset ? (
          <CanvasToolbar
            toolMode={interaction.toolMode}
            laneDrawArmed={laneDrawArmed}
            onModeChange={(mode: ToolMode) => {
              laneDraftRef.current = null;
              setLaneDraft(null);
              setLaneDrawArmed(false);
              setToolMode(mode);
            }}
            onActivatePaletteItem={activatePaletteItem}
            onPalettePointerDown={handlePalettePointerDown}
            onAutoLayout={() => void autoLayout()}
          />
        ) : null}

        {!isClassicPreset ? (
          <ViewportControls
            zoom={zoom}
            snapToGrid={interaction.snapToGrid}
            onToggleSnap={toggleSnap}
            onNewDocument={handleNewDocument}
            onCopyExport={(format) => void handleCopyExport(format)}
            onDownloadExport={downloadExport}
            onImportMermaidFile={(file) => void handleOpenMermaidFile(file)}
            onImportXmlText={handleImportXmlText}
            onImportXmlFile={(file) => void handleImportXmlFile(file)}
            onFitView={() => fitView({ padding: 0.2, duration: 220 })}
            onReset={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 })}
            onZoomOut={() => zoomOut({ duration: 120 })}
            onZoomIn={() => zoomIn({ duration: 120 })}
          />
        ) : null}

        <ViewportHud zoom={zoom} visible={!isClassicPreset && interaction.viewportHudVisible} />
        <Toast message={message} visible={showToast} />

        {edgeEditor ? (
          <div className="edge-editor-popover">
            <input
              ref={edgeEditorInputRef}
              value={edgeEditor.value}
              onChange={(event) => setEdgeEditor((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
              onKeyDown={onEdgeEditorKeyDown}
              placeholder="连线标签"
            />
            <button onClick={commitEdgeLabel}>保存</button>
            <button onClick={() => setEdgeEditor(null)}>取消</button>
          </div>
        ) : null}

        {paletteDragSession?.active ? (
          <PaletteDragPreview
            itemId={paletteDragSession.itemId}
            x={paletteDragSession.pointerClientX}
            y={paletteDragSession.pointerClientY}
            insideCanvas={paletteDragSession.overCanvas}
          />
        ) : null}

        {quickCreateSession && quickCreatePopoverAnchor ? (
          <QuickCreatePopover
            x={quickCreatePopoverAnchor.x}
            y={quickCreatePopoverAnchor.y}
            onSelect={completeQuickCreate}
            onClose={() => setQuickCreateSession(null)}
          />
        ) : null}

      </main>

      <aside className={`panel panel--right ${rightPanelOpen ? "is-open" : "is-collapsed"}`}>
        <div className="panel--right__chrome">
          {rightPanelOpen ? <div className="panel--right__title">Mermaid</div> : null}
          <button
            className="panel-toggle-button"
            onClick={() => setRightPanelOpen((prev) => !prev)}
            title={rightPanelOpen ? "收起右侧边栏" : "展开右侧边栏"}
            aria-label={rightPanelOpen ? "收起右侧边栏" : "展开右侧边栏"}
          >
            <SidebarToggleIcon collapsed={!rightPanelOpen} />
          </button>
        </div>

        {rightPanelOpen ? (
          <>
            <section>
              <h2>Mermaid 代码</h2>
              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                spellCheck={false}
                className="code-box"
              />
              {warnings.length > 0 ? (
                <ul className="warning-list">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section>
              <div className="preview-head">
                <h2>实时预览</h2>
              </div>
              <div className="preview">
                {previewError ? <div className="preview-error">{previewError}</div> : null}
                {!previewError ? <div dangerouslySetInnerHTML={{ __html: previewSvg }} /> : null}
              </div>
            </section>
          </>
        ) : (
          <div className="panel--right__collapsed-label">代码</div>
        )}
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <EditorApp />
    </ReactFlowProvider>
  );
}

function normalizeHandle(handleId: string | null | undefined): EdgeHandlePosition | undefined {
  if (!handleId) {
    return undefined;
  }

  if (handleId === "left" || handleId === "right" || handleId === "top" || handleId === "bottom") {
    return handleId;
  }

  return undefined;
}

interface AlignmentGuides {
  vertical: number[];
  horizontal: number[];
}

interface DragNodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LaneDraft {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
}

interface PaletteDragSession {
  itemId: PaletteItemId;
  startClientX: number;
  startClientY: number;
  pointerClientX: number;
  pointerClientY: number;
  active: boolean;
  overCanvas: boolean;
}

interface QuickCreateSession {
  sourceNodeId: string;
  direction: QuickConnectDirection;
  sourceHandle: EdgeHandlePosition;
  anchorClientX: number;
  anchorClientY: number;
}

const QUICK_CREATE_POPOVER_WIDTH = 244;
const QUICK_CREATE_POPOVER_HEIGHT = 196;
const QUICK_CREATE_POPOVER_MARGIN = 16;

function calculateAlignmentSnap(
  draggedNode: DragNodeBox,
  candidates: DiagramNode[],
): { snappedX: number | null; snappedY: number | null; guides: AlignmentGuides } {
  const threshold = 8;
  const draggedXAnchors = [
    { type: "left", value: draggedNode.x },
    { type: "center", value: draggedNode.x + draggedNode.width / 2 },
    { type: "right", value: draggedNode.x + draggedNode.width },
  ] as const;

  const draggedYAnchors = [
    { type: "top", value: draggedNode.y },
    { type: "center", value: draggedNode.y + draggedNode.height / 2 },
    { type: "bottom", value: draggedNode.y + draggedNode.height },
  ] as const;

  let bestX: { target: number; anchor: (typeof draggedXAnchors)[number]["type"]; diff: number } | null = null;
  let bestY: { target: number; anchor: (typeof draggedYAnchors)[number]["type"]; diff: number } | null = null;

  for (const candidate of candidates) {
    if (candidate.id === draggedNode.id) {
      continue;
    }

    const candidateWidth = candidate.width ?? 148;
    const candidateHeight = candidate.height ?? 72;
    const candidateXAnchors = [candidate.x, candidate.x + candidateWidth / 2, candidate.x + candidateWidth];
    const candidateYAnchors = [candidate.y, candidate.y + candidateHeight / 2, candidate.y + candidateHeight];

    for (const source of draggedXAnchors) {
      for (const target of candidateXAnchors) {
        const diff = Math.abs(source.value - target);
        if (diff > threshold) {
          continue;
        }
        if (!bestX || diff < bestX.diff) {
          bestX = { target, anchor: source.type, diff };
        }
      }
    }

    for (const source of draggedYAnchors) {
      for (const target of candidateYAnchors) {
        const diff = Math.abs(source.value - target);
        if (diff > threshold) {
          continue;
        }
        if (!bestY || diff < bestY.diff) {
          bestY = { target, anchor: source.type, diff };
        }
      }
    }
  }

  return {
    snappedX: bestX ? anchorToPositionX(bestX.anchor, bestX.target, draggedNode.width) : null,
    snappedY: bestY ? anchorToPositionY(bestY.anchor, bestY.target, draggedNode.height) : null,
    guides: {
      vertical: bestX ? [bestX.target] : [],
      horizontal: bestY ? [bestY.target] : [],
    },
  };
}

function anchorToPositionX(anchor: "left" | "center" | "right", target: number, width: number): number {
  if (anchor === "center") {
    return target - width / 2;
  }
  if (anchor === "right") {
    return target - width;
  }
  return target;
}

function anchorToPositionY(anchor: "top" | "center" | "bottom", target: number, height: number): number {
  if (anchor === "center") {
    return target - height / 2;
  }
  if (anchor === "bottom") {
    return target - height;
  }
  return target;
}

function toggleSelectionId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function findContainingGroupId(node: DragNodeBox, groups: DiagramGroup[]): string | undefined {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const hiddenGroupIds = buildHiddenGroupIds(groups);

  return groups
    .filter(
      (group) =>
        isGroupVisible(group, hiddenGroupIds) &&
        centerX >= group.x &&
        centerX <= group.x + group.width &&
        centerY >= group.y + 36 &&
        centerY <= group.y + group.height,
    )
    .sort((a, b) => a.width * a.height - b.width * b.height)
    .at(0)?.id;
}

function findNearestNodeInDirection(
  sourceNode: DiagramNode,
  direction: QuickConnectDirection,
  nodes: DiagramNode[],
): DiagramNode | undefined {
  const sourceBox = toNodeBox(sourceNode);
  const sourceCenter = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };

  return nodes
    .filter((target) => target.id !== sourceNode.id)
    .map((target) => {
      const box = toNodeBox(target);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const primaryDistance =
        direction === "right"
          ? center.x - sourceCenter.x
          : direction === "left"
            ? sourceCenter.x - center.x
            : direction === "bottom"
              ? center.y - sourceCenter.y
              : sourceCenter.y - center.y;
      const orthogonalOffset =
        direction === "right" || direction === "left"
          ? Math.abs(center.y - sourceCenter.y)
          : Math.abs(center.x - sourceCenter.x);

      return { target, primaryDistance, orthogonalOffset };
    })
    .filter(({ target, primaryDistance, orthogonalOffset }) => {
      if (primaryDistance <= 24 || primaryDistance > 360) {
        return false;
      }
      const sameParent = target.parentGroupId === sourceNode.parentGroupId;
      const maxOffset = direction === "right" || direction === "left" ? 160 : 200;
      return orthogonalOffset <= maxOffset || sameParent;
    })
    .sort((a, b) => {
      const groupBoostA = a.target.parentGroupId === sourceNode.parentGroupId ? -120 : 0;
      const groupBoostB = b.target.parentGroupId === sourceNode.parentGroupId ? -120 : 0;
      const scoreA = a.primaryDistance + a.orthogonalOffset * 0.35 + groupBoostA;
      const scoreB = b.primaryDistance + b.orthogonalOffset * 0.35 + groupBoostB;
      return scoreA - scoreB;
    })
    .at(0)?.target;
}

function getQuickCreatePlacement(
  sourceNode: DiagramNode,
  direction: QuickConnectDirection,
  itemId: PaletteItemId,
): { center: { x: number; y: number } } {
  const sourceBox = toNodeBox(sourceNode);
  const item = getPaletteItem(itemId);
  const width = item.defaultSize.width;
  const height = item.defaultSize.height;
  const gap = 96;

  let centerX = sourceBox.x + sourceBox.width / 2;
  let centerY = sourceBox.y + sourceBox.height / 2;

  if (direction === "right") {
    centerX = sourceBox.x + sourceBox.width + gap + width / 2;
  } else if (direction === "left") {
    centerX = sourceBox.x - gap - width / 2;
  } else if (direction === "top") {
    centerY = sourceBox.y - gap - height / 2;
  } else {
    centerY = sourceBox.y + sourceBox.height + gap + height / 2;
  }

  return { center: { x: roundCanvasValue(centerX), y: roundCanvasValue(centerY) } };
}

function oppositeHandle(handle: EdgeHandlePosition): EdgeHandlePosition {
  if (handle === "left") {
    return "right";
  }
  if (handle === "right") {
    return "left";
  }
  if (handle === "top") {
    return "bottom";
  }
  return "top";
}

function toNodeBox(node: DiagramNode): DragNodeBox {
  const fallbackSize = getDefaultNodeSize(node.type);
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width ?? fallbackSize.width,
    height: node.height ?? fallbackSize.height,
  };
}

function getEdgeHandleAnchor(box: DragNodeBox, handle: EdgeHandlePosition): { x: number; y: number } {
  if (handle === "left") {
    return { x: box.x, y: box.y + box.height / 2 };
  }
  if (handle === "right") {
    return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
  if (handle === "top") {
    return { x: box.x + box.width / 2, y: box.y };
  }
  return { x: box.x + box.width / 2, y: box.y + box.height };
}

function getBoundingBox(items: Array<Pick<DragNodeBox, "x" | "y" | "width" | "height">>): DragNodeBox {
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return {
    id: "__selection__",
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function toScreenRect(
  rect: Pick<DragNodeBox, "x" | "y" | "width" | "height">,
  viewport: { x: number; y: number; zoom: number },
): Omit<InlineOverlayRect, "targetType"> {
  return {
    x: rect.x * viewport.zoom + viewport.x,
    y: rect.y * viewport.zoom + viewport.y,
    width: rect.width * viewport.zoom,
    height: rect.height * viewport.zoom,
  };
}

function pickLaneOrientation(width: number, height: number): "horizontal" | "vertical" {
  return width >= height ? "horizontal" : "vertical";
}

function normalizeDraftBounds(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function toLocalDraftStyle(draft: LaneDraft, rect: DOMRect): CSSProperties {
  const left = Math.min(draft.startClientX, draft.currentClientX) - rect.left;
  const top = Math.min(draft.startClientY, draft.currentClientY) - rect.top;
  const width = Math.abs(draft.currentClientX - draft.startClientX);
  const height = Math.abs(draft.currentClientY - draft.startClientY);

  return {
    left,
    top,
    width,
    height,
  };
}

function roundCanvasValue(value: number): number {
  return Math.round(value);
}

function stopUiEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function clampQuickCreatePopoverAnchor(anchorClientX: number, anchorClientY: number, workspaceRect: DOMRect) {
  const localX = anchorClientX - workspaceRect.left;
  const localY = anchorClientY - workspaceRect.top;
  const minX = QUICK_CREATE_POPOVER_WIDTH / 2 + QUICK_CREATE_POPOVER_MARGIN;
  const maxX = workspaceRect.width - QUICK_CREATE_POPOVER_WIDTH / 2 - QUICK_CREATE_POPOVER_MARGIN;
  const minY = QUICK_CREATE_POPOVER_HEIGHT + QUICK_CREATE_POPOVER_MARGIN;
  const maxY = workspaceRect.height - QUICK_CREATE_POPOVER_MARGIN;

  return {
    x: clampNumber(localX, minX, maxX),
    y: clampNumber(localY, minY, maxY),
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function isPrintableKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="panel-toggle-button__icon">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d={collapsed ? "M9 8l4 4-4 4" : "M15 8l-4 4 4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 5v14" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
    </svg>
  );
}
