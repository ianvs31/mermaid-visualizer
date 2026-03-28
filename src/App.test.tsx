import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import App from "./App";
import { loadStoredDocument, saveStoredDocument, saveWorkspaceState } from "./app/document-persistence";
import { useEditorStore } from "./app/store";

const IMPORTABLE_DRAWIO_XML = `<mxGraphModel><root>
  <mxCell id="0" />
  <mxCell id="1" parent="0" />
  <mxCell id="node-start" value="导入开始" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">
    <mxGeometry x="120" y="120" width="130" height="66" as="geometry" />
  </mxCell>
  <mxCell id="node-next" value="导入步骤" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
    <mxGeometry x="360" y="120" width="148" height="72" as="geometry" />
  </mxCell>
  <mxCell id="edge-1" value="继续" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="node-start" target="node-next">
    <mxGeometry relative="1" as="geometry" />
  </mxCell>
</root></mxGraphModel>`;

const INVALID_COMPRESSED_XML = `<mxfile><diagram>Zm9vYmFy</diagram></mxfile>`;

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  localStorage.clear();
  useEditorStore.getState().loadSample();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  localStorage.clear();
  useEditorStore.getState().loadSample();
});

describe("App", () => {
  it("renders sample nodes on canvas", async () => {
    render(<App />);
    const starts = await screen.findAllByText("开始", {}, { timeout: 12000 });
    expect(starts.length).toBeGreaterThan(0);
    const matched = await screen.findAllByText("提交申请", {}, { timeout: 12000 });
    expect(matched.length).toBeGreaterThan(0);
  }, 15000);

  it("boots with a saved draft present", async () => {
    const restoredModel = {
      version: 2 as const,
      direction: "LR" as const,
      rawPassthroughStatements: [],
      groups: [],
      nodes: [
        { id: "R1", type: "start" as const, label: "恢复开始", x: 80, y: 120, width: 130, height: 66 },
        { id: "R2", type: "process" as const, label: "恢复处理", x: 280, y: 120, width: 148, height: 72 },
      ],
      edges: [{ id: "RE1", from: "R1", to: "R2", label: "", strokePattern: "solid" }],
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

    render(<App />);

    await screen.findAllByText("恢复开始", {}, { timeout: 12000 });
    expect(useEditorStore.getState().code).toContain("R1-->R2");
    expect(useEditorStore.getState().message.text).toContain("恢复");
  }, 15000);

  it("shows the current browser-local document identity in the document bar", async () => {
    saveStoredDocument({
      version: 1,
      id: "doc-1",
      title: "最近文档",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:10:00.000Z",
      lastOpenedAt: "2026-03-28T10:15:00.000Z",
      code: "flowchart LR\nB-->C",
      codeDirty: false,
      model: {
        version: 2,
        direction: "LR",
        rawPassthroughStatements: [],
        groups: [],
        nodes: [
          { id: "B", type: "start", label: "开始", x: 80, y: 120, width: 130, height: 66 },
          { id: "C", type: "process", label: "继续", x: 280, y: 120, width: 148, height: 72 },
        ],
        edges: [{ id: "E1", from: "B", to: "C", label: "", strokePattern: "solid" }],
      },
    });
    saveWorkspaceState({ version: 1, lastOpenedDocumentId: "doc-1" });

    render(<App />);

    expect(await screen.findByRole("textbox", { name: "文档标题" })).toHaveValue("最近文档");
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  }, 15000);

  it("persists edited document changes through the app-level persistence hook", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.doubleClick(targetNode!);

    const input = await waitFor(() => {
      const element = container.querySelector(".inline-text-overlay--editing") as HTMLInputElement | null;
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.change(input, { target: { value: "启动" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const currentId = useEditorStore.getState().currentDocumentId;
      expect(currentId).toBeTruthy();
      expect(loadStoredDocument(currentId!)?.code).toContain("N1([启动])");
      expect(loadStoredDocument(currentId!)?.codeDirty).toBe(false);
    });
  }, 15000);

  it("persists renamed document titles through the app-level autosave flow", async () => {
    render(<App />);

    const titleInput = await screen.findByRole("textbox", { name: "文档标题" });
    fireEvent.change(titleInput, { target: { value: "新的流程图" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      const currentId = useEditorStore.getState().currentDocumentId;
      expect(currentId).toBeTruthy();
      expect(loadStoredDocument(currentId!)?.title).toBe("新的流程图");
    });
  }, 15000);

  it("debounces preview rendering to the latest code edit", async () => {
    const renderSpy = vi.spyOn(mermaid, "render").mockResolvedValue({ svg: "<svg></svg>" } as Awaited<
      ReturnType<typeof mermaid.render>
    >);

    try {
      const { container } = render(<App />);
      await screen.findAllByText("开始", {}, { timeout: 12000 });
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalled();
      });

      renderSpy.mockClear();
      const textbox = container.querySelector("textarea.code-box");
      expect(textbox).not.toBeNull();
      vi.useFakeTimers();

      fireEvent.change(textbox!, { target: { value: "flowchart LR\nA-->B" } });
      fireEvent.change(textbox!, { target: { value: "flowchart LR\nA-->C" } });

      expect(renderSpy).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(259);
      });

      expect(renderSpy).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      vi.useRealTimers();

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy).toHaveBeenLastCalledWith(expect.any(String), "flowchart LR\nA-->C");
      });
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("deletes a clicked node with Delete", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node[data-model-id="N1"]')).toBeNull();
    });
  }, 15000);

  it("cuts a clicked node with Ctrl/Cmd+X", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    act(() => {
      localStorage.clear();
      useEditorStore.getState().loadSample();
    });

    const targetNode = await waitFor(() => {
      const element = container.querySelector('.react-flow__node[data-model-id="N1"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node[data-model-id="N1"]')).toBeNull();
    });
  }, 15000);

  it("edits node label inline on double click", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.doubleClick(targetNode!);

    const input = await waitFor(() => {
      const element = container.querySelector(".inline-text-overlay--editing") as HTMLInputElement | null;
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.change(input, { target: { value: "启动" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(useEditorStore.getState().code).toContain("N1([启动])");
    });
  }, 15000);

  it("allows clearing node label before typing a new Chinese label", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.doubleClick(targetNode!);

    const input = await waitFor(() => {
      const element = container.querySelector(".inline-text-overlay--editing") as HTMLInputElement | null;
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "中文开始" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(useEditorStore.getState().code).toContain("N1([中文开始])");
    });
  }, 15000);

  it("edits swimlane title inline on double click", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("业务侧", {}, { timeout: 12000 });

    const groupNode = container.querySelector('.react-flow__node[data-model-id="G1"]');
    expect(groupNode).not.toBeNull();

    fireEvent.doubleClick(groupNode!);

    const input = await waitFor(() => {
      const element = container.querySelector(".inline-text-overlay--editing") as HTMLInputElement | null;
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.change(input, { target: { value: "新泳道" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(useEditorStore.getState().code).toContain("subgraph G1[新泳道]");
    });
  }, 15000);

  it("collapses a swimlane from the group header control", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "折叠 业务侧" }));

    await waitFor(() => {
      expect(useEditorStore.getState().model.groups.find((group) => group.id === "G1")?.collapsed).toBe(true);
    });
  }, 15000);

  it("shows lightweight edge controls only for a single selected edge", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    act(() => {
      useEditorStore.getState().setSelection([], ["E1"], []);
    });

    expect(await screen.findByRole("button", { name: "编辑标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "实线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "虚线" })).toBeInTheDocument();

    act(() => {
      useEditorStore.getState().setSelection(["N1"], ["E1"], []);
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "编辑标签" })).toBeNull();
    });
  }, 15000);

  it("edits edge labels from the lightweight edge toolbar", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    act(() => {
      useEditorStore.getState().setSelection([], ["E1"], []);
    });

    fireEvent.click(await screen.findByRole("button", { name: "编辑标签" }));

    const input = await screen.findByPlaceholderText("连线标签");
    fireEvent.change(input, { target: { value: "继续处理" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(useEditorStore.getState().code).toContain("N1 -->|继续处理| N2");
    });
  }, 15000);

  it("toggles selected edges to dashed from the lightweight edge toolbar", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    act(() => {
      useEditorStore.getState().setSelection([], ["E1"], []);
    });

    fireEvent.click(await screen.findByRole("button", { name: "虚线" }));

    await waitFor(() => {
      expect(useEditorStore.getState().model.edges.find((edge) => edge.id === "E1")?.strokePattern).toBe("dashed");
      expect(useEditorStore.getState().code).toContain("N1 -.-> N2");
    });
  }, 15000);

  it("opens the edge label editor on direct edge double click", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const edge = await waitFor(() => {
      const element = container.querySelector('.react-flow__edge[data-model-id="E1"]');
      expect(element).not.toBeNull();
      return element as Element;
    });

    fireEvent.doubleClick(edge);

    expect(await screen.findByPlaceholderText("连线标签")).toBeInTheDocument();
  }, 15000);

  it("hides swimlane descendants again after collapse, expand, then collapse", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const collapse = await screen.findByRole("button", { name: "折叠 业务侧" });
    fireEvent.click(collapse);
    fireEvent.click(await screen.findByRole("button", { name: "展开 业务侧" }));
    fireEvent.click(await screen.findByRole("button", { name: "折叠 业务侧" }));

    await waitFor(() => {
      expect(useEditorStore.getState().model.groups.find((group) => group.id === "G1")?.collapsed).toBe(true);
      expect(container.querySelector('.react-flow__node[data-model-id="N1"]')).toBeNull();
      expect(container.querySelector('.react-flow__node[data-model-id="N2"]')).toBeNull();
      expect(container.querySelector('.react-flow__edge[data-model-id="E1"]')).toBeNull();
    });
  }, 15000);

  it("moves selected nodes into the selected group from the contextual action", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N4"]');
    const targetGroup = container.querySelector('.react-flow__node[data-model-id="G1"]');
    expect(targetNode).not.toBeNull();
    expect(targetGroup).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.click(targetGroup!, { shiftKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "移入当前分区" }));

    await waitFor(() => {
      expect(useEditorStore.getState().model.nodes.find((node) => node.id === "N4")?.parentGroupId).toBe("G1");
    });
  }, 15000);

  it("arms swimlane drawing mode from the bottom toolbar", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    fireEvent.click(screen.getByRole("button", { name: "泳道" }));

    expect(screen.getByText("拖拽创建泳道区域，按 Esc 取消")).toBeInTheDocument();
  }, 15000);

  it("updates selected node appearance from the figjam toolbar", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.click(screen.getByRole("button", { name: "填充" }));
    fireEvent.click(screen.getByRole("tab", { name: "半透明" }));
    fireEvent.click(screen.getByRole("listitem", { name: "选择颜色 #eb5c33" }));
    fireEvent.click(screen.getByRole("button", { name: /^实线$/ }));
    fireEvent.click(screen.getByRole("listitem", { name: "选择颜色 #7b57ea" }));
    fireEvent.click(screen.getByRole("tab", { name: "虚线" }));

    await waitFor(() => {
      const code = useEditorStore.getState().code;
      expect(code).toContain("%% editor:appearance N1 fillMode=transparent fillColor=#eb5c33 strokeColor=#7b57ea strokePattern=dashed");
      expect(code).toContain("style N1");
    });
  }, 15000);

  it("starts replace-mode rename when typing on a single selected node", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-model-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.keyDown(window, { key: "启" });

    const input = await waitFor(() => {
      const element = container.querySelector(".inline-text-overlay--editing") as HTMLInputElement | null;
      expect(element).not.toBeNull();
      return element!;
    });

    expect(input.value).toBe("启");

    fireEvent.change(input, { target: { value: "启动节点" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(useEditorStore.getState().code).toContain("N1([启动节点])");
    });
  }, 15000);

  it("does not start rename while multiple nodes are selected", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const node1 = container.querySelector('.react-flow__node[data-model-id="N1"]');
    const node2 = container.querySelector('.react-flow__node[data-model-id="N2"]');
    expect(node1).not.toBeNull();
    expect(node2).not.toBeNull();

    fireEvent.click(node1!);
    fireEvent.click(node2!, { shiftKey: true });
    fireEvent.keyDown(window, { key: "A" });

    expect(container.querySelector(".inline-text-overlay--editing")).toBeNull();
  }, 15000);

  it("applies fill color to multiple selected nodes", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    act(() => {
      useEditorStore.getState().setSelection(["N2"], [], []);
      useEditorStore.getState().updateSelectedNodeAppearance({ fillColor: "#eb5c33" });
      useEditorStore.getState().setSelection(["N1", "N2"], [], []);
    });

    const mixedButton = await screen.findByRole("button", { name: "混合" });
    fireEvent.click(mixedButton);
    fireEvent.click(screen.getByRole("tab", { name: "填充" }));
    fireEvent.click(screen.getByRole("listitem", { name: "选择颜色 #eb5c33" }));

    await waitFor(() => {
      const code = useEditorStore.getState().code;
      expect(code).toContain("%% editor:appearance N1");
      expect(code).toContain("fillColor=#eb5c33");
      expect(code).toContain("%% editor:appearance N2");
    });
  }, 15000);

  it("shows XML import actions and imports via paste", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(IMPORTABLE_DRAWIO_XML);

    fireEvent.click(screen.getByRole("button", { name: "帮助与导出" }));
    fireEvent.click(screen.getByRole("button", { name: "粘贴 draw.io XML" }));

    await waitFor(() => {
      const code = useEditorStore.getState().code;
      expect(code).toContain("flowchart LR");
      expect(code).toContain("导入开始");
      expect(code).toContain("导入步骤");
    });

    promptSpy.mockRestore();
  }, 15000);

  it("keeps only document identity controls in the right sidebar", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    expect(document.querySelector(".document-bar")).toBeNull();
    expect(screen.getByRole("complementary")).toHaveTextContent("文档");
    expect(screen.getByRole("complementary")).toHaveTextContent("Mermaid");
    expect(screen.queryByText("侧边栏")).toBeNull();
    expect(screen.getByRole("textbox", { name: "文档标题" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "最近文档" })).toBeInTheDocument();
    expect(screen.queryByText("文档操作")).toBeNull();
    expect(screen.queryByRole("button", { name: "新建文档" })).toBeNull();
    expect(screen.queryByRole("button", { name: "创建副本" })).toBeNull();
    expect(screen.queryByRole("button", { name: "导入 Mermaid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "导入 draw.io" })).toBeNull();
    expect(screen.queryByRole("button", { name: "下载 Mermaid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.queryByRole("button", { name: "draw.io" })).toBeNull();
  }, 15000);

  it("switches documents from the sidebar recent-documents control", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const before = useEditorStore.getState().code;
    const previousId = useEditorStore.getState().currentDocumentId;
    act(() => {
      useEditorStore.getState().createDocument();
    });

    await waitFor(() => {
      expect(useEditorStore.getState().currentDocumentId).not.toBe(previousId);
      expect(useEditorStore.getState().code).toBe("flowchart LR");
      expect(useEditorStore.getState().message.text).toContain("新建");
    });

    fireEvent.change(screen.getByRole("combobox", { name: "最近文档" }), {
      target: { value: previousId },
    });

    await waitFor(() => {
      expect(useEditorStore.getState().currentDocumentId).toBe(previousId);
      expect(useEditorStore.getState().code).toBe(before);
    });
  }, 15000);

  it("keeps current diagram when pasted XML import fails", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });
    const before = useEditorStore.getState().code;

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(INVALID_COMPRESSED_XML);

    fireEvent.click(screen.getByRole("button", { name: "帮助与导出" }));
    fireEvent.click(screen.getByRole("button", { name: "粘贴 draw.io XML" }));

    await waitFor(() => {
      expect(useEditorStore.getState().code).toBe(before);
    });

    promptSpy.mockRestore();
  }, 15000);
});
