import { deflateRaw } from "pako";
import { describe, expect, it } from "vitest";
import { parseMermaidFlowchartV2 } from "./parser";
import { ImportDrawioError, importDrawioXml } from "./import-drawio";

const RAW_GRAPH_XML = `<mxGraphModel dx="1280" dy="720" grid="1"><root>
  <mxCell id="0" />
  <mxCell id="1" parent="0" />
  <mxCell id="group-A" value="业务侧" style="swimlane;rounded=1;fillColor=#f9fafb;strokeColor=#94a3b8;" vertex="1" parent="1">
    <mxGeometry x="40" y="40" width="420" height="220" as="geometry" />
  </mxCell>
  <mxCell id="node-start" value="开始" style="ellipse;whiteSpace=wrap;html=1;fillColor=#fff;" vertex="1" parent="group-A">
    <mxGeometry x="80" y="48" width="130" height="66" as="geometry" />
  </mxCell>
  <mxCell id="node-check" value="是否通过?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff;" vertex="1" parent="group-A">
    <mxGeometry x="286" y="38" width="132" height="132" as="geometry" />
  </mxCell>
  <mxCell id="edge-1" value="提交" style="edgeStyle=orthogonalEdgeStyle;dashed=1;endArrow=block;" edge="1" parent="1" source="node-start" target="node-check">
    <mxGeometry relative="1" as="geometry" />
  </mxCell>
</root></mxGraphModel>`;

function buildCompressedDiagramPayload(xml: string): string {
  const encoded = encodeURIComponent(xml);
  const compressed = deflateRaw(encoded);
  let binary = "";
  for (const byte of compressed) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function expectImportError(input: string, code: ImportDrawioError["code"]): void {
  try {
    importDrawioXml(input);
    throw new Error("Expected importDrawioXml to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ImportDrawioError);
    expect((error as ImportDrawioError).code).toBe(code);
  }
}

describe("importDrawioXml", () => {
  it("imports raw mxGraphModel XML", () => {
    const result = importDrawioXml(RAW_GRAPH_XML);

    expect(result.model.groups).toHaveLength(1);
    expect(result.model.nodes).toHaveLength(2);
    expect(result.model.edges).toHaveLength(1);
    expect(result.model.direction).toBe("LR");
    expect(result.model.groups[0].id).toBe("G1");
    expect(result.model.nodes[0].id).toBe("N1");
    expect(result.model.nodes[1].id).toBe("N2");
    expect(result.model.edges[0].id).toBe("E1");
    expect(result.mermaid).toContain("flowchart LR");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("imports mxfile wrapper with direct mxGraphModel child", () => {
    const wrapped = `<mxfile><diagram id="page-1" name="Page-1">${RAW_GRAPH_XML}</diagram></mxfile>`;
    const result = importDrawioXml(wrapped);

    expect(result.model.nodes).toHaveLength(2);
    expect(result.model.groups[0].title).toBe("业务侧");
    expect(result.mermaid).toContain("subgraph G1[业务侧]");
  });

  it("imports compressed diagram payload in mxfile", () => {
    const compressed = buildCompressedDiagramPayload(RAW_GRAPH_XML);
    const wrapped = `<mxfile><diagram id="page-1">${compressed}</diagram></mxfile>`;
    const result = importDrawioXml(wrapped);

    expect(result.model.nodes).toHaveLength(2);
    expect(result.model.edges).toHaveLength(1);
    expect(result.mermaid).toContain("flowchart LR");
  });

  it("imports first diagram and returns warning for multi-page mxfile", () => {
    const secondPage = RAW_GRAPH_XML.replace("业务侧", "第二页");
    const wrapped = `<mxfile><diagram id="page-1">${RAW_GRAPH_XML}</diagram><diagram id="page-2">${secondPage}</diagram></mxfile>`;
    const result = importDrawioXml(wrapped);

    expect(result.model.groups[0].title).toBe("业务侧");
    expect(result.warnings.some((warning) => warning.includes("多页"))).toBe(true);
  });

  it("normalizes external IDs and keeps mermaid parseable", () => {
    const source = RAW_GRAPH_XML
      .replaceAll("node-start", "node start@A")
      .replaceAll("node-check", "node/check#B")
      .replaceAll("group-A", "group:A");

    const result = importDrawioXml(source);
    const reparsed = parseMermaidFlowchartV2(result.mermaid);

    expect(reparsed.errors).toHaveLength(0);
    expect(result.mermaid).not.toContain("node start@A");
    expect(result.mermaid).not.toContain("node/check#B");
    expect(result.model.nodes.every((node) => /^N\d+$/.test(node.id))).toBe(true);
  });

  it("skips edges with missing endpoints and reports warning", () => {
    const broken = `<mxGraphModel><root>
      <mxCell id="0" />
      <mxCell id="1" parent="0" />
      <mxCell id="node-A" value="A" style="rounded=1;" vertex="1" parent="1">
        <mxGeometry x="40" y="40" width="120" height="60" as="geometry" />
      </mxCell>
      <mxCell id="edge-1" value="broken" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="missing" target="node-A">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>
    </root></mxGraphModel>`;

    const result = importDrawioXml(broken);
    expect(result.model.edges).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes("缺失端点"))).toBe(true);
  });

  it("throws INVALID_XML for malformed XML", () => {
    expectImportError("<mxGraphModel><root></mxGraphModel>", "INVALID_XML");
  });

  it("throws DECOMPRESS_FAILED for invalid compressed diagram", () => {
    const wrapped = `<mxfile><diagram>Zm9vYmFy</diagram></mxfile>`;
    expectImportError(wrapped, "DECOMPRESS_FAILED");
  });
});
