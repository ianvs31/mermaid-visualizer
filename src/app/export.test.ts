import { describe, expect, it } from "vitest";
import { buildDrawioXml, buildEditorExportBundle, buildMarkdownMermaid } from "./export";
import type { DiagramModel } from "./types";

const model: DiagramModel = {
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
      childNodeIds: ["N1"],
      childGroupIds: [],
      laneMeta: { orientation: "horizontal", order: 1 },
      x: 40,
      y: 40,
      width: 420,
      height: 220,
    },
  ],
  nodes: [
    {
      id: "N1",
      type: "process",
      label: "提交申请",
      x: 80,
      y: 96,
      width: 148,
      height: 72,
      parentGroupId: "G1",
      appearance: {
        fillColor: "#eb5c33",
        strokeColor: "#1f2937",
        fillMode: "none",
        strokePattern: "dashed",
        strokeWidth: 2,
        cornerRadius: 10,
      },
    },
  ],
  edges: [{ id: "E1", from: "N1", to: "N1", label: "loop", strokePattern: "solid" }],
};

describe("export helpers", () => {
  it("builds markdown mermaid blocks", () => {
    const output = buildMarkdownMermaid(model);
    expect(output.startsWith("```mermaid\nflowchart LR")).toBe(true);
    expect(output.trimEnd().endsWith("```"));
  });

  it("builds editor export bundles", () => {
    const bundle = buildEditorExportBundle(model);
    expect(bundle.version).toBe(1);
    expect(bundle.format).toBe("mermaid-visualizer");
    expect(bundle.mermaid).toContain("flowchart LR");
    expect(bundle.model.nodes[0].id).toBe("N1");
  });

  it("builds draw.io xml", () => {
    const xml = buildDrawioXml(model);
    expect(xml).toContain("<mxGraphModel");
    expect(xml).toContain('id="N1"');
    expect(xml).toContain("fillColor=none");
    expect(xml).toContain("dashed=1");
  });
});
