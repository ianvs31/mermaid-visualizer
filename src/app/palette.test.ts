import { describe, expect, it } from "vitest";
import { PALETTE_ITEMS, QUICK_CREATE_ITEMS, getPaletteItem } from "./palette";

describe("palette registry", () => {
  it("exposes the slim toolbar item set", () => {
    expect(PALETTE_ITEMS.map((item) => item.label)).toEqual(["起止", "步骤", "判断", "泳道"]);
  });

  it("keeps quick-create limited to connectable node items", () => {
    expect(QUICK_CREATE_ITEMS.map((item) => item.id)).toEqual(["rounded", "process", "decision"]);
    expect(QUICK_CREATE_ITEMS.some((item) => item.id === "swimlane")).toBe(false);
  });

  it("resolves palette definitions by id", () => {
    expect(getPaletteItem("rounded").label).toBe("起止");
    expect(getPaletteItem("swimlane").kind).toBe("group");
  });
});
