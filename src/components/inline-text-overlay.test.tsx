import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineTextOverlay, type InlineArmedTarget } from "./InlineTextOverlay";

afterEach(() => {
  cleanup();
});

const armedTarget: InlineArmedTarget = {
  targetType: "node",
  targetId: "N1",
  label: "开始",
  rect: {
    targetType: "node",
    x: 100,
    y: 120,
    width: 148,
    height: 72,
  },
};

describe("InlineTextOverlay", () => {
  it("starts type-to-rename from a printable key", () => {
    const onBeginTypeRename = vi.fn();
    render(
      <InlineTextOverlay
        armedTarget={armedTarget}
        onBeginTypeRename={onBeginTypeRename}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { hidden: true });
    fireEvent.keyDown(input, { key: "启" });

    expect(onBeginTypeRename).toHaveBeenCalledWith(armedTarget);
  });

  it("commits after composition finishes", async () => {
    const onCommit = vi.fn();
    render(
      <InlineTextOverlay
        session={{
          targetType: "node",
          targetId: "N1",
          initialValue: "",
          sessionId: "session-1",
          source: "type-to-rename",
          replaceMode: "replaceAll",
        }}
        targetRect={armedTarget.rect}
        onBeginTypeRename={vi.fn()}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "中文节点" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: "中文节点" });

    await Promise.resolve();
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "N1" }),
      "中文节点",
    );
  });
});
