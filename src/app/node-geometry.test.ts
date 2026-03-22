import { describe, expect, it } from "vitest";
import { getDefaultNodeSize, START_NODE_SIZE, TERMINATOR_NODE_SIZE } from "./node-geometry";

describe("node geometry defaults", () => {
  it("uses the same stadium size for start and terminator nodes", () => {
    expect(START_NODE_SIZE).toEqual(TERMINATOR_NODE_SIZE);
    expect(getDefaultNodeSize("start")).toEqual(getDefaultNodeSize("terminator"));
  });
});
