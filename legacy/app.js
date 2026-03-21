import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

const palette = document.getElementById("palette");
const canvas = document.getElementById("canvas");
const edgesSvg = document.getElementById("edgesSvg");
const preview = document.getElementById("preview");
const mermaidCode = document.getElementById("mermaidCode");
const codeStatus = document.getElementById("codeStatus");
const btnApplyCode = document.getElementById("btnApplyCode");
const btnRender = document.getElementById("btnRender");
const btnClear = document.getElementById("btnClear");
const btnSample = document.getElementById("btnSample");

const DEFAULT_DIRECTION = "LR";

const NODE_TYPES = [
  { type: "start", label: "开始/结束" },
  { type: "process", label: "处理步骤" },
  { type: "decision", label: "判断" },
  { type: "terminator", label: "终止" },
];

const state = {
  nodes: [],
  edges: [],
  nextNodeId: 1,
  nextEdgeId: 1,
  selectedNodeId: null,
  selectedEdgeId: null,
  drag: null,
  connect: null,
  lineDraft: null,
  direction: DEFAULT_DIRECTION,
  isSyncingCode: false,
  codeInputTimer: null,
};

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });

init();

function init() {
  renderPalette();
  bindEvents();
  loadSample();
}

function renderPalette() {
  palette.innerHTML = "";
  for (const item of NODE_TYPES) {
    const btn = document.createElement("button");
    btn.className = "palette-item";
    btn.textContent = `+ ${item.label}`;
    btn.addEventListener("click", () => addNode(item.type));
    palette.appendChild(btn);
  }
}

function bindEvents() {
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }
    if (isTextInputEvent(event)) {
      return;
    }

    event.preventDefault();
    if (state.selectedNodeId) {
      deleteNode(state.selectedNodeId);
      return;
    }
    if (state.selectedEdgeId) {
      deleteEdge(state.selectedEdgeId);
    }
  });

  btnRender.addEventListener("click", () => renderMermaidPreview());
  btnApplyCode.addEventListener("click", applyMermaidCodeToCanvas);
  btnClear.addEventListener("click", clearCanvas);
  btnSample.addEventListener("click", loadSample);

  mermaidCode.addEventListener("input", () => {
    if (state.isSyncingCode) {
      return;
    }
    setCodeStatus("文本已修改，可点击“同步到画布”", "");
    debouncePreviewRender();
  });

  mermaidCode.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      applyMermaidCodeToCanvas();
    }
  });

  canvas.addEventListener("dblclick", (event) => {
    const nodeEl = event.target.closest(".node");
    if (!nodeEl) {
      return;
    }
    const node = getNode(nodeEl.dataset.id);
    const next = window.prompt("节点文本", node.label);
    if (next === null) {
      return;
    }
    node.label = next.trim() || node.label;
    update();
  });
}

function isTextInputEvent(event) {
  const target = event.target;
  return target instanceof HTMLElement && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
}

function onCanvasPointerDown(event) {
  const connector = event.target.closest(".connector");
  if (connector) {
    const nodeEl = connector.closest(".node");
    startConnecting(nodeEl.dataset.id, event);
    return;
  }

  const nodeEl = event.target.closest(".node");
  if (nodeEl) {
    selectNode(nodeEl.dataset.id);
    startDragging(nodeEl.dataset.id, event);
    return;
  }

  clearSelection();
}

function startDragging(nodeId, event) {
  const node = getNode(nodeId);
  const canvasRect = canvas.getBoundingClientRect();

  state.drag = {
    nodeId,
    offsetX: event.clientX - canvasRect.left - node.x,
    offsetY: event.clientY - canvasRect.top - node.y,
  };

  const nodeEl = getNodeElement(nodeId);
  if (nodeEl) {
    nodeEl.classList.add("dragging");
  }
}

function onPointerMove(event) {
  if (state.drag) {
    const node = getNode(state.drag.nodeId);
    const canvasRect = canvas.getBoundingClientRect();
    const maxX = canvas.clientWidth - getNodeWidth(node);
    const maxY = canvas.clientHeight - getNodeHeight(node);

    node.x = clamp(event.clientX - canvasRect.left - state.drag.offsetX, 8, Math.max(8, maxX));
    node.y = clamp(event.clientY - canvasRect.top - state.drag.offsetY, 8, Math.max(8, maxY));
    refreshNodePosition(node);
    renderEdges();
    updateMermaidCode();
    return;
  }

  if (state.connect && state.lineDraft) {
    const point = eventToCanvasPoint(event);
    state.lineDraft.setAttribute("d", edgePath(state.connect.fromPoint, point));
  }
}

function onPointerUp(event) {
  if (state.drag) {
    const nodeEl = getNodeElement(state.drag.nodeId);
    if (nodeEl) {
      nodeEl.classList.remove("dragging");
    }
    state.drag = null;
    renderMermaidPreview();
    return;
  }

  if (state.connect) {
    const targetNodeEl = event.target.closest(".node");
    const targetId = targetNodeEl?.dataset.id;
    if (targetId && targetId !== state.connect.fromId) {
      addEdge(state.connect.fromId, targetId);
    }
    stopConnecting();
  }
}

function startConnecting(nodeId, event) {
  const node = getNode(nodeId);
  state.connect = {
    fromId: nodeId,
    fromPoint: getConnectorPoint(node),
  };
  clearSelection();

  const p = eventToCanvasPoint(event);
  state.lineDraft = document.createElementNS("http://www.w3.org/2000/svg", "path");
  state.lineDraft.setAttribute("d", edgePath(state.connect.fromPoint, p));
  state.lineDraft.setAttribute("class", "draft");
  edgesSvg.appendChild(state.lineDraft);
}

function stopConnecting() {
  if (state.lineDraft) {
    state.lineDraft.remove();
  }
  state.lineDraft = null;
  state.connect = null;
}

function addNode(type, x = 40, y = 40, label = "") {
  const id = `N${state.nextNodeId++}`;
  const defaultLabelMap = {
    start: "开始",
    process: "处理",
    decision: "是否通过?",
    terminator: "结束",
  };

  state.nodes.push({
    id,
    type,
    label: label || defaultLabelMap[type] || "节点",
    x,
    y,
  });

  update();
  return id;
}

function deleteNode(nodeId) {
  state.nodes = state.nodes.filter((n) => n.id !== nodeId);
  state.edges = state.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  clearSelection();
  update();
}

function addEdge(from, to, label = "") {
  const duplicated = state.edges.some((e) => e.from === from && e.to === to);
  if (duplicated) {
    return;
  }

  state.edges.push({
    id: `E${state.nextEdgeId++}`,
    from,
    to,
    label,
  });

  update();
}

function deleteEdge(edgeId) {
  state.edges = state.edges.filter((e) => e.id !== edgeId);
  clearSelection();
  update();
}

function update() {
  renderNodes();
  renderEdges();
  updateMermaidCode();
  renderMermaidPreview();
}

function renderNodes() {
  const oldNodes = Array.from(canvas.querySelectorAll(".node"));
  for (const el of oldNodes) {
    el.remove();
  }

  for (const node of state.nodes) {
    const el = document.createElement("div");
    el.className = `node ${shapeClassName(node.type)}`;
    el.dataset.id = node.id;
    if (state.selectedNodeId === node.id) {
      el.classList.add("selected");
    }

    el.innerHTML = `<span class="label">${escapeHtml(node.label)}</span><span class="connector" title="拖拽创建连线"></span>`;
    refreshNodePosition(node, el);
    canvas.appendChild(el);
  }
}

function renderEdges() {
  const existing = Array.from(edgesSvg.querySelectorAll("path.edge"));
  for (const path of existing) {
    path.remove();
  }

  for (const edge of state.edges) {
    const fromNode = getNode(edge.from);
    const toNode = getNode(edge.to);
    if (!fromNode || !toNode) {
      continue;
    }

    const fromPoint = getConnectorPoint(fromNode);
    const toPoint = getTargetPoint(toNode);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `edge${state.selectedEdgeId === edge.id ? " selected" : ""}`);
    path.setAttribute("d", edgePath(fromPoint, toPoint));
    path.dataset.id = edge.id;
    path.style.pointerEvents = "stroke";
    path.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      selectEdge(edge.id);
    });

    edgesSvg.appendChild(path);
  }
}

function refreshNodePosition(node, nodeEl = null) {
  const el = nodeEl || getNodeElement(node.id);
  if (!el) {
    return;
  }

  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
}

function updateMermaidCode() {
  const lines = [`flowchart ${normalizeDirection(state.direction)}`];

  for (const node of state.nodes) {
    lines.push(`  ${node.id}${mermaidNodeShape(node.type, sanitizeMermaidLabel(node.label))}`);
  }

  for (const edge of state.edges) {
    const hasLabel = edge.label && edge.label.trim();
    lines.push(
      hasLabel
        ? `  ${edge.from} -->|${sanitizeMermaidLabel(edge.label)}| ${edge.to}`
        : `  ${edge.from} --> ${edge.to}`,
    );
  }

  state.isSyncingCode = true;
  mermaidCode.value = lines.join("\n");
  state.isSyncingCode = false;
}

function debouncePreviewRender() {
  if (state.codeInputTimer) {
    window.clearTimeout(state.codeInputTimer);
  }
  state.codeInputTimer = window.setTimeout(() => {
    renderMermaidPreview();
  }, 220);
}

async function renderMermaidPreview() {
  const code = mermaidCode.value.trim();
  if (!code) {
    preview.innerHTML = "";
    return;
  }

  try {
    const graphId = `graph-${Date.now()}`;
    const { svg } = await mermaid.render(graphId, code);
    preview.innerHTML = svg;
  } catch (error) {
    preview.innerHTML = `<div class="error">${escapeHtml(String(error))}</div>`;
  }
}

function applyMermaidCodeToCanvas() {
  const code = mermaidCode.value;
  try {
    const parsed = parseMermaidFlowchart(code);
    const positions = buildAutoLayout(parsed.nodes, parsed.edges, parsed.direction);

    state.direction = parsed.direction;
    state.nodes = parsed.nodes.map((node) => {
      const pos = positions.get(node.id) || { x: 40, y: 40 };
      return { ...node, ...pos };
    });
    state.edges = parsed.edges.map((edge, index) => ({
      id: `E${index + 1}`,
      from: edge.from,
      to: edge.to,
      label: edge.label,
    }));

    state.nextNodeId = deriveNextNodeId(state.nodes);
    state.nextEdgeId = state.edges.length + 1;
    clearSelection();
    update();
    setCodeStatus("已同步到画布", "success");
  } catch (error) {
    setCodeStatus(String(error), "error");
  }
}

function parseMermaidFlowchart(input) {
  const rawLines = input.split(/\r?\n/);
  let startIndex = 0;
  let direction = DEFAULT_DIRECTION;
  let foundHeader = false;

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = stripMermaidComment(rawLines[i]).trim();
    if (!line) {
      continue;
    }

    const headerMatch = line.match(/^(flowchart|graph)\s+([A-Za-z]{2})\s*$/i);
    if (headerMatch) {
      direction = normalizeDirection(headerMatch[2]);
      startIndex = i + 1;
      foundHeader = true;
    } else {
      startIndex = i;
    }
    break;
  }

  if (!foundHeader && rawLines.every((line) => !stripMermaidComment(line).trim())) {
    throw new Error("Mermaid 文本为空");
  }

  const nodeMap = new Map();
  const edges = [];

  for (let i = startIndex; i < rawLines.length; i += 1) {
    const content = stripMermaidComment(rawLines[i]).trim();
    if (!content) {
      continue;
    }

    const segments = content
      .split(";")
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (const segment of segments) {
      if (isIgnoredStatement(segment)) {
        continue;
      }

      if (segment.includes("-->")) {
        parseEdgeStatement(segment, i + 1, nodeMap, edges);
      } else {
        parseNodeStatement(segment, i + 1, nodeMap);
      }
    }
  }

  if (nodeMap.size === 0) {
    throw new Error("未解析到节点，请检查 Mermaid 语法");
  }

  return {
    direction,
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

function isIgnoredStatement(statement) {
  return /^(subgraph|end|classDef|class|style|linkStyle|click)\b/i.test(statement);
}

function parseEdgeStatement(statement, lineNo, nodeMap, edges) {
  const match = statement.match(/^(.*?)-->\s*(?:\|([^|]*)\|)?\s*(.*?)$/);
  if (!match) {
    throw new Error(`第 ${lineNo} 行连线语法无法识别: ${statement}`);
  }

  const fromToken = parseEndpointToken(match[1].trim());
  const toToken = parseEndpointToken(match[3].trim());
  if (!fromToken || !toToken) {
    throw new Error(`第 ${lineNo} 行节点定义无法识别: ${statement}`);
  }

  registerNodeToken(nodeMap, fromToken);
  registerNodeToken(nodeMap, toToken);

  const edgeLabel = (match[2] || "").trim();
  const exists = edges.some((edge) => edge.from === fromToken.id && edge.to === toToken.id);
  if (!exists) {
    edges.push({
      from: fromToken.id,
      to: toToken.id,
      label: stripWrappedQuotes(edgeLabel),
    });
  }
}

function parseNodeStatement(statement, lineNo, nodeMap) {
  const endpoint = parseEndpointToken(statement.trim());
  if (!endpoint) {
    throw new Error(`第 ${lineNo} 行节点语法无法识别: ${statement}`);
  }
  registerNodeToken(nodeMap, endpoint);
}

function parseEndpointToken(token) {
  const match = token.match(/^([A-Za-z_][A-Za-z0-9_-]*)(?:\((.*)\)|\[(.*)\]|\{(.*)\})?$/);
  if (!match) {
    return null;
  }

  const id = match[1];
  let shape = null;
  let label = null;

  if (match[2] !== undefined) {
    shape = "round";
    label = stripWrappedQuotes(match[2].trim()) || id;
  } else if (match[3] !== undefined) {
    shape = "rect";
    label = stripWrappedQuotes(match[3].trim()) || id;
  } else if (match[4] !== undefined) {
    shape = "decision";
    label = stripWrappedQuotes(match[4].trim()) || id;
  }

  return { id, shape, label };
}

function registerNodeToken(nodeMap, token) {
  const existing = nodeMap.get(token.id);
  const fallbackLabel = existing?.label || token.id;
  const label = token.label || fallbackLabel;
  const type = token.shape ? mapShapeToNodeType(token.shape, label) : existing?.type || "process";

  nodeMap.set(token.id, {
    id: token.id,
    type,
    label,
  });
}

function mapShapeToNodeType(shape, label) {
  if (shape === "decision") {
    return "decision";
  }
  if (shape === "round") {
    return /(结束|终止|完成|END|STOP)/i.test(label) ? "terminator" : "start";
  }
  return "process";
}

function buildAutoLayout(nodes, edges, direction) {
  const nodeIds = nodes.map((node) => node.id);
  const adjacency = new Map();
  const indegree = new Map();
  const level = new Map();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
    indegree.set(nodeId, 0);
    level.set(nodeId, 0);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  }

  const pending = new Set(nodeIds);
  const queue = nodeIds.filter((id) => indegree.get(id) === 0);

  while (pending.size > 0) {
    if (queue.length === 0) {
      queue.push(Array.from(pending)[0]);
    }

    const current = queue.shift();
    if (!pending.has(current)) {
      continue;
    }

    pending.delete(current);
    const nextNodes = adjacency.get(current);
    for (const next of nextNodes) {
      if (!pending.has(next)) {
        continue;
      }

      level.set(next, Math.max(level.get(next), level.get(current) + 1));
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) <= 0) {
        queue.push(next);
      }
    }
  }

  const grouped = new Map();
  for (const node of nodes) {
    const l = level.get(node.id) || 0;
    if (!grouped.has(l)) {
      grouped.set(l, []);
    }
    grouped.get(l).push(node.id);
  }

  const positions = new Map();
  const vertical = isVerticalDirection(direction);
  const sortedLevels = Array.from(grouped.keys()).sort((a, b) => a - b);

  for (const l of sortedLevels) {
    const ids = grouped.get(l);
    ids.sort((a, b) => a.localeCompare(b));

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const x = vertical ? 60 + i * 220 : 50 + l * 220;
      const y = vertical ? 50 + l * 130 : 60 + i * 130;
      positions.set(id, { x, y });
    }
  }

  return positions;
}

function isVerticalDirection(direction) {
  const dir = normalizeDirection(direction);
  return dir === "TB" || dir === "TD" || dir === "BT";
}

function loadSample() {
  state.direction = "LR";
  state.nodes = [
    { id: "N1", type: "start", label: "开始", x: 40, y: 120 },
    { id: "N2", type: "process", label: "提交申请", x: 220, y: 120 },
    { id: "N3", type: "decision", label: "审批通过?", x: 430, y: 90 },
    { id: "N4", type: "process", label: "执行任务", x: 640, y: 40 },
    { id: "N5", type: "process", label: "驳回并通知", x: 640, y: 210 },
    { id: "N6", type: "terminator", label: "结束", x: 860, y: 120 },
  ];
  state.edges = [
    { id: "E1", from: "N1", to: "N2", label: "" },
    { id: "E2", from: "N2", to: "N3", label: "" },
    { id: "E3", from: "N3", to: "N4", label: "是" },
    { id: "E4", from: "N3", to: "N5", label: "否" },
    { id: "E5", from: "N4", to: "N6", label: "" },
    { id: "E6", from: "N5", to: "N6", label: "" },
  ];

  state.nextNodeId = 7;
  state.nextEdgeId = 7;
  clearSelection();
  update();
  setCodeStatus("可直接编辑 Mermaid 文本", "");
}

function clearCanvas() {
  state.direction = DEFAULT_DIRECTION;
  state.nodes = [];
  state.edges = [];
  state.nextNodeId = 1;
  state.nextEdgeId = 1;
  clearSelection();
  update();
  setCodeStatus("画布已清空", "");
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  state.selectedEdgeId = null;
  renderNodes();
  renderEdges();
}

function selectEdge(edgeId) {
  state.selectedEdgeId = edgeId;
  state.selectedNodeId = null;
  renderNodes();
  renderEdges();
}

function clearSelection() {
  state.selectedNodeId = null;
  state.selectedEdgeId = null;
  renderNodes();
  renderEdges();
}

function getNode(id) {
  return state.nodes.find((n) => n.id === id);
}

function getNodeElement(id) {
  return canvas.querySelector(`.node[data-id="${id}"]`);
}

function shapeClassName(type) {
  return (
    {
      start: "round",
      process: "rect",
      decision: "diamond",
      terminator: "round",
    }[type] || "rect"
  );
}

function mermaidNodeShape(type, label) {
  if (type === "decision") {
    return `{${label}}`;
  }
  if (type === "start" || type === "terminator") {
    return `(${label})`;
  }
  return `[${label}]`;
}

function getConnectorPoint(node) {
  return {
    x: node.x + getNodeWidth(node),
    y: node.y + getNodeHeight(node) / 2,
  };
}

function getTargetPoint(node) {
  return {
    x: node.x,
    y: node.y + getNodeHeight(node) / 2,
  };
}

function getNodeWidth(node) {
  if (node.type === "decision") {
    return 112;
  }
  return 126;
}

function getNodeHeight(node) {
  if (node.type === "decision") {
    return 112;
  }
  return 58;
}

function edgePath(start, end) {
  const dx = Math.max(30, Math.abs(end.x - start.x) * 0.45);
  const cp1x = start.x + dx;
  const cp2x = end.x - dx;
  return `M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`;
}

function eventToCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function sanitizeMermaidLabel(input) {
  return input.replace(/"/g, "'").replace(/[\n\r]/g, " ").trim();
}

function normalizeDirection(direction) {
  const value = String(direction || DEFAULT_DIRECTION).toUpperCase();
  if (["LR", "RL", "TB", "TD", "BT"].includes(value)) {
    return value;
  }
  return DEFAULT_DIRECTION;
}

function stripMermaidComment(line) {
  const index = line.indexOf("%%");
  if (index < 0) {
    return line;
  }
  return line.slice(0, index);
}

function stripWrappedQuotes(input) {
  const text = String(input || "").trim();
  if (text.length < 2) {
    return text;
  }

  const startsWithDouble = text.startsWith('"') && text.endsWith('"');
  const startsWithSingle = text.startsWith("'") && text.endsWith("'");
  if (startsWithDouble || startsWithSingle) {
    return text.slice(1, -1);
  }

  return text;
}

function deriveNextNodeId(nodes) {
  let max = 0;
  for (const node of nodes) {
    const match = node.id.match(/^N(\d+)$/i);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

function setCodeStatus(text, tone = "") {
  codeStatus.textContent = text;
  codeStatus.className = `code-status${tone ? ` ${tone}` : ""}`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
