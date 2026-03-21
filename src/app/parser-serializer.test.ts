import { describe, expect, it } from "vitest";
import { parseMermaidFlowchartV2 } from "./parser";
import { serializeMermaidFlowchartV2 } from "./serializer";

describe("parseMermaidFlowchartV2", () => {
  it("parses subgraph, styles, classes and lane metadata", () => {
    const source = `flowchart LR
%% editor:lane G1 horizontal 1
subgraph G1[业务侧]
  direction LR
  N1(开始)
  N2[提交申请]
end
N1 -->|提交| N2
class N2 approved
style N2 fill:#ecfeff,stroke:#0369a1
linkStyle 0 stroke:#334155`;

    const result = parseMermaidFlowchartV2(source);
    expect(result.errors).toHaveLength(0);
    expect(result.model.groups).toHaveLength(1);
    expect(result.model.groups[0].type).toBe("swimlane");
    expect(result.model.groups[0].laneMeta?.orientation).toBe("horizontal");

    const n2 = result.model.nodes.find((node) => node.id === "N2");
    expect(n2?.classNames).toContain("approved");
    expect(n2?.appearance?.fillMode).toBe("solid");
    expect(n2?.appearance?.fillColor).toBe("#ecfeff");
    expect(n2?.appearance?.strokeColor).toBe("#0369a1");
    expect(n2?.style).toBeUndefined();

    expect(result.model.rawPassthroughStatements).toContain("linkStyle 0 stroke:#334155");
  });

  it("keeps unsupported chain edge as passthrough", () => {
    const source = `flowchart LR\nA-->B-->C`;
    const result = parseMermaidFlowchartV2(source);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.model.rawPassthroughStatements).toContain("A-->B-->C");
  });
});

describe("serializeMermaidFlowchartV2", () => {
  it("serializes with lane metadata and raw statements", () => {
    const parsed = parseMermaidFlowchartV2(`flowchart LR\nA[开始]\nB[结束]\nA-->B`);
    parsed.model.groups.push({
      id: "G2",
      type: "swimlane",
      title: "泳道 2",
      direction: "LR",
      parentGroupId: undefined,
      childNodeIds: [],
      childGroupIds: [],
      laneMeta: { orientation: "horizontal", order: 2 },
      x: 40,
      y: 40,
      width: 300,
      height: 180,
    });
    parsed.model.rawPassthroughStatements.push("classDef pass fill:#dcfce7");
    parsed.model.nodes[0].appearance = {
      fillColor: "#5fa1ef",
      strokeColor: "#1f3d66",
      fillMode: "transparent",
      strokePattern: "dashed",
      strokeWidth: 2,
      cornerRadius: 16,
    };

    const code = serializeMermaidFlowchartV2(parsed.model);
    expect(code).toContain("flowchart LR");
    expect(code).toContain("%% editor:lane G2 horizontal 2");
    expect(code).toContain(
      "%% editor:appearance A fillMode=transparent fillColor=#5fa1ef strokeColor=#1f3d66 strokePattern=dashed radius=16 width=2",
    );
    expect(code).toContain("subgraph G2[泳道 2]");
    expect(code).toContain("classDef pass fill:#dcfce7");
  });

  it("supports parse -> serialize round-trip for subgraph", () => {
    const source = `flowchart TB
subgraph G1[审核区]
  N1(开始)
  N2{通过?}
end
N1 --> N2`;

    const parsed = parseMermaidFlowchartV2(source);
    const out = serializeMermaidFlowchartV2(parsed.model);
    const reparsed = parseMermaidFlowchartV2(out);

    expect(reparsed.model.groups.some((group) => group.id === "G1")).toBe(true);
    expect(reparsed.model.nodes.some((node) => node.id === "N2" && node.type === "decision")).toBe(true);
    expect(reparsed.model.edges.some((edge) => edge.from === "N1" && edge.to === "N2")).toBe(true);
  });

  it("round-trips empty labels through editor metadata", () => {
    const parsed = parseMermaidFlowchartV2(`flowchart LR\nN1[开始]\nN2[结束]\nN1-->N2`);
    parsed.model.nodes[0].label = "";

    const out = serializeMermaidFlowchartV2(parsed.model);
    const reparsed = parseMermaidFlowchartV2(out);

    expect(out).toContain("%% editor:empty-label N1");
    expect(reparsed.model.nodes.find((node) => node.id === "N1")?.label).toBe("");
  });

  it("round-trips explicit appearance metadata", () => {
    const source = `flowchart LR
%% editor:appearance N1 fillMode=transparent fillColor=#5fa1ef strokeColor=#4b89d0 strokePattern=dashed radius=16 width=2
N1[开始]
style N1 fill:rgba(95, 161, 239, 0.18),stroke:#4b89d0,color:#1f2937,stroke-width:2px,stroke-dasharray:6 4,border-radius:16px`;

    const parsed = parseMermaidFlowchartV2(source);
    const out = serializeMermaidFlowchartV2(parsed.model);
    const reparsed = parseMermaidFlowchartV2(out);

    expect(reparsed.model.nodes.find((node) => node.id === "N1")?.appearance).toMatchObject({
      fillColor: "#5fa1ef",
      strokeColor: "#4b89d0",
      fillMode: "transparent",
      strokePattern: "dashed",
      cornerRadius: 16,
      strokeWidth: 2,
    });
  });

  it("reads legacy base metadata for compatibility", () => {
    const parsed = parseMermaidFlowchartV2(`flowchart LR
%% editor:appearance N1 base=#5fa1ef fill=transparent stroke=dashed radius=16 width=2
N1[开始]
style N1 fill:rgba(95, 161, 239, 0.18),stroke:#4b89d0,color:#1f2937,stroke-width:2px,stroke-dasharray:6 4,border-radius:16px`);

    expect(parsed.model.nodes.find((node) => node.id === "N1")?.appearance).toMatchObject({
      fillColor: "#5fa1ef",
      strokeColor: "#5fa1ef",
      fillMode: "transparent",
      strokePattern: "dashed",
    });
  });
});
