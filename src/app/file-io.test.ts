import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultFilenameFor, downloadTextFile } from "./file-io";

describe("file I/O helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps export formats to stable download filenames", () => {
    expect(defaultFilenameFor("editor-json", "审批 流程")).toBe("审批-流程.mermaid-visualizer.json");
    expect(defaultFilenameFor("markdown-mermaid", "  ")).toBe("untitled-diagram.md");
    expect(defaultFilenameFor("drawio-xml", "导入图表")).toBe("导入图表.drawio.xml");
  });

  it("downloads text files through a temporary blob URL", () => {
    const originalCreateElement = document.createElement.bind(document);
    const createObjectURL = vi.fn(() => "blob:test-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    const click = vi.fn();
    const anchor = originalCreateElement("a");
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        Object.defineProperty(anchor, "click", { value: click, configurable: true });
        return anchor;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    downloadTextFile("diagram.md", "flowchart LR", "text/markdown;charset=utf-8");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:test-url");
    expect(anchor.download).toBe("diagram.md");
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});
