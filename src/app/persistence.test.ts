import { describe, expect, it } from "vitest";
import { loadDraftSnapshot } from "./persistence";

describe("draft persistence", () => {
  it("restores a valid versioned draft", () => {
    localStorage.setItem(
      "mv:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-03-21T10:00:00.000Z",
        code: "flowchart LR\nA-->B",
        model: {
          version: 2,
          direction: "LR",
          nodes: [],
          edges: [],
          groups: [],
          rawPassthroughStatements: [],
        },
      }),
    );

    expect(loadDraftSnapshot()?.code).toContain("flowchart LR");
  });

  it("returns null for malformed payloads", () => {
    localStorage.setItem("mv:draft", "{broken");
    expect(loadDraftSnapshot()).toBeNull();
  });
});
