import { describe, expect, it } from "vitest";
import {
  getDecisionInnerSquareSize,
  getDefaultNodeSize,
  getNodeInteractionOutset,
  QUICK_CONNECT_BUTTON_OFFSET,
  QUICK_CONNECT_BUTTON_SIZE,
  START_NODE_SIZE,
  TERMINATOR_NODE_SIZE,
} from "./node-geometry";

describe("node geometry defaults", () => {
  it("uses the same stadium size for start and terminator nodes", () => {
    expect(START_NODE_SIZE).toEqual(TERMINATOR_NODE_SIZE);
    expect(getDefaultNodeSize("start")).toEqual(getDefaultNodeSize("terminator"));
  });

  it("expands the interaction zone to the quick-connect extrema", () => {
    expect(getNodeInteractionOutset()).toBe(QUICK_CONNECT_BUTTON_SIZE + QUICK_CONNECT_BUTTON_OFFSET);
  });

  it("fits the decision inner square as the largest centered square", () => {
    expect(getDecisionInnerSquareSize({ type: "decision", width: 132, height: 132 })).toBeCloseTo(132 / Math.SQRT2, 4);
    expect(getDecisionInnerSquareSize({ type: "decision", width: 180, height: 132 })).toBeCloseTo(132 / Math.SQRT2, 4);
  });
});
