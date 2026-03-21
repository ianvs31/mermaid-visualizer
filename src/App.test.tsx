import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
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
  localStorage.clear();
  useEditorStore.getState().loadSample();
});

afterEach(() => {
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

    render(<App />);

    await screen.findAllByText("恢复开始", {}, { timeout: 12000 });
    expect(useEditorStore.getState().code).toContain("R1-->R2");
    expect(useEditorStore.getState().message.text).toContain("恢复");
  }, 15000);

  it("persists edited drafts through the app-level persistence hook", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
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
      const draft = JSON.parse(localStorage.getItem("mv:draft") ?? "{}");
      expect(draft.code).toContain("N1(启动)");
      expect(draft.codeDirty).toBe(false);
      expect(draft.version).toBe(1);
    });
  }, 15000);

  it("deletes a clicked node with Delete", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node[data-id="N1"]')).toBeNull();
    });
  }, 15000);

  it("cuts a clicked node with Ctrl/Cmd+X", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
    expect(targetNode).not.toBeNull();

    fireEvent.click(targetNode!);
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node[data-id="N1"]')).toBeNull();
    });
  }, 15000);

  it("edits node label inline on double click", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
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
      expect(useEditorStore.getState().code).toContain("N1(启动)");
    });
  }, 15000);

  it("allows clearing node label before typing a new Chinese label", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
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
      expect(useEditorStore.getState().code).toContain("N1(中文开始)");
    });
  }, 15000);

  it("edits swimlane title inline on double click", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("业务侧", {}, { timeout: 12000 });

    const groupNode = container.querySelector('.react-flow__node[data-id="G1"]');
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

  it("arms swimlane drawing mode from the bottom toolbar", async () => {
    render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    fireEvent.click(screen.getByRole("button", { name: "泳道" }));

    expect(screen.getByText("拖拽创建泳道区域，按 Esc 取消")).toBeInTheDocument();
  }, 15000);

  it("updates selected node appearance from the figjam toolbar", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
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

    const targetNode = container.querySelector('.react-flow__node[data-id="N1"]');
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
      expect(useEditorStore.getState().code).toContain("N1(启动节点)");
    });
  }, 15000);

  it("does not start rename while multiple nodes are selected", async () => {
    const { container } = render(<App />);
    await screen.findAllByText("开始", {}, { timeout: 12000 });

    const node1 = container.querySelector('.react-flow__node[data-id="N1"]');
    const node2 = container.querySelector('.react-flow__node[data-id="N2"]');
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
    expect(screen.getByRole("button", { name: "导入 draw.io 文件" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "粘贴 draw.io XML" }));

    await waitFor(() => {
      const code = useEditorStore.getState().code;
      expect(code).toContain("flowchart LR");
      expect(code).toContain("导入开始");
      expect(code).toContain("导入步骤");
    });

    promptSpy.mockRestore();
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
