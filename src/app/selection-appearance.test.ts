import { describe, expect, it } from "vitest";
import { summarizeNodeAppearances } from "./selection-appearance";

describe("summarizeNodeAppearances", () => {
  it("returns concrete values when all selected nodes match", () => {
    const summary = summarizeNodeAppearances([
      {
        id: "N1",
        type: "process",
        label: "A",
        x: 0,
        y: 0,
        appearance: {
          fillMode: "solid",
          fillColor: "#ffffff",
          strokeColor: "#344054",
          strokePattern: "solid",
          strokeWidth: 2,
          cornerRadius: 10,
        },
      },
      {
        id: "N2",
        type: "process",
        label: "B",
        x: 0,
        y: 0,
        appearance: {
          fillMode: "solid",
          fillColor: "#ffffff",
          strokeColor: "#344054",
          strokePattern: "solid",
          strokeWidth: 2,
          cornerRadius: 10,
        },
      },
    ]);

    expect(summary).toEqual({
      fillMode: "solid",
      fillColor: "#ffffff",
      strokeColor: "#344054",
      strokePattern: "solid",
      strokeWidth: 2,
    });
  });

  it("returns mixed for divergent appearance values", () => {
    const summary = summarizeNodeAppearances([
      {
        id: "N1",
        type: "process",
        label: "A",
        x: 0,
        y: 0,
        appearance: {
          fillMode: "solid",
          fillColor: "#ffffff",
          strokeColor: "#344054",
          strokePattern: "solid",
          strokeWidth: 2,
          cornerRadius: 10,
        },
      },
      {
        id: "N2",
        type: "process",
        label: "B",
        x: 0,
        y: 0,
        appearance: {
          fillMode: "transparent",
          fillColor: "#5fa1ef",
          strokeColor: "#7b57ea",
          strokePattern: "dashed",
          strokeWidth: 3,
          cornerRadius: 10,
        },
      },
    ]);

    expect(summary).toEqual({
      fillMode: "mixed",
      fillColor: "mixed",
      strokeColor: "mixed",
      strokePattern: "mixed",
      strokeWidth: "mixed",
    });
  });
});
