import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { ContextToolbar } from "./ContextToolbar";

afterEach(() => {
  cleanup();
});

describe("CanvasToolbar", () => {
  it("switches tool mode by click", () => {
    const onModeChange = vi.fn();
    render(
      <CanvasToolbar
        toolMode="select"
        onModeChange={onModeChange}
        onActivatePaletteItem={vi.fn()}
        onPalettePointerDown={vi.fn()}
        onAutoLayout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "手型" }));
    expect(onModeChange).toHaveBeenCalledWith("pan");
  });

  it("renders slim figjam toolbar items", () => {
    render(
      <CanvasToolbar
        toolMode="select"
        onModeChange={vi.fn()}
        onActivatePaletteItem={vi.fn()}
        onPalettePointerDown={vi.fn()}
        onAutoLayout={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "连线" })).toBeNull();
    expect(screen.queryByRole("button", { name: "节点" })).toBeNull();
    expect(screen.queryByRole("button", { name: "文本" })).toBeNull();
    expect(screen.queryByRole("button", { name: "结束" })).toBeNull();
    expect(screen.getByRole("button", { name: "起止" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "步骤" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "判断" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "泳道" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一键布局" })).toBeInTheDocument();
  });
});

describe("ContextToolbar", () => {
  it("shows only fill and stroke controls", () => {
    render(
      <ContextToolbar
        visible
        x={100}
        y={120}
        mode="single"
        appearance={{
          fillColor: "#5fa1ef",
          strokeColor: "#1f3d66",
          fillMode: "transparent",
          strokePattern: "solid",
          strokeWidth: 2,
          cornerRadius: 10,
        }}
        paint={{
          fill: "rgba(95, 161, 239, 0.18)",
          stroke: "#1f3d66",
          color: "#1f2937",
          strokeWidth: 2,
          borderRadius: 10,
        }}
        onSetFillColor={vi.fn()}
        onSetStrokeColor={vi.fn()}
        onSetFillMode={vi.fn()}
        onSetStrokePattern={vi.fn()}
      />,
    );

    expect(screen.getByRole("toolbar", { name: "选中对象上下文工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "半透明" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^实线$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "圆角" })).toBeNull();
  });

  it("updates fill and stroke independently", () => {
    const onSetFillColor = vi.fn();
    const onSetStrokeColor = vi.fn();
    const onSetFillMode = vi.fn();
    const onSetStrokePattern = vi.fn();

    render(
      <ContextToolbar
        visible
        x={100}
        y={120}
        mode="single"
        appearance={{
          fillColor: "#5fa1ef",
          strokeColor: "#1f3d66",
          fillMode: "transparent",
          strokePattern: "solid",
          strokeWidth: 2,
          cornerRadius: 10,
        }}
        paint={{
          fill: "rgba(95, 161, 239, 0.18)",
          stroke: "#1f3d66",
          color: "#1f2937",
          strokeWidth: 2,
          borderRadius: 10,
        }}
        onSetFillColor={onSetFillColor}
        onSetStrokeColor={onSetStrokeColor}
        onSetFillMode={onSetFillMode}
        onSetStrokePattern={onSetStrokePattern}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "半透明" }));
    fireEvent.click(screen.getByRole("tab", { name: "填充" }));
    fireEvent.click(screen.getByRole("listitem", { name: "选择颜色 #eb5c33" }));
    fireEvent.click(screen.getByRole("button", { name: /^实线$/ }));
    fireEvent.click(screen.getByRole("listitem", { name: "选择颜色 #7b57ea" }));
    fireEvent.click(screen.getByRole("tab", { name: "虚线" }));

    expect(onSetFillMode).toHaveBeenCalledWith("solid");
    expect(onSetFillColor).toHaveBeenCalledWith("#eb5c33");
    expect(onSetStrokeColor).toHaveBeenCalledWith("#7b57ea");
    expect(onSetStrokePattern).toHaveBeenCalledWith("dashed");
  });

  it("supports mixed state for multi-selection", () => {
    render(
      <ContextToolbar
        visible
        x={100}
        y={120}
        mode="multi"
        appearance={{
          fillColor: "mixed",
          strokeColor: "mixed",
          fillMode: "mixed",
          strokePattern: "mixed",
          strokeWidth: "mixed",
        }}
        onSetFillColor={vi.fn()}
        onSetStrokeColor={vi.fn()}
        onSetFillMode={vi.fn()}
        onSetStrokePattern={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "混合" }).length).toBeGreaterThan(0);
  });
});
