import { describe, expect, it } from "vitest";
import { buildStyleFromAppearance, deriveNodePaint, inferAppearanceFromStyle } from "./appearance";

describe("appearance helpers", () => {
  it("keeps fill and stroke colors independent", () => {
    const paint = deriveNodePaint({
      fillColor: "#5fa1ef",
      strokeColor: "#eb5c33",
      fillMode: "transparent",
      strokePattern: "dashed",
      strokeWidth: 2,
      cornerRadius: 16,
    });

    expect(paint.fill).toBe("rgba(95, 161, 239, 0.18)");
    expect(paint.stroke).toBe("#eb5c33");
    expect(paint.strokeDasharray).toBe("6 4");
    expect(paint.borderRadius).toBe(16);
  });

  it("infers appearance back from serialized style blocks", () => {
    const appearance = inferAppearanceFromStyle(
      buildStyleFromAppearance({
        fillColor: "#eb5c33",
        strokeColor: "#1f2937",
        fillMode: "solid",
        strokePattern: "solid",
        strokeWidth: 2,
        cornerRadius: 24,
      }),
    );

    expect(appearance?.fillMode).toBe("solid");
    expect(appearance?.fillColor).toBe("#eb5c33");
    expect(appearance?.strokeColor).toBe("#1f2937");
    expect(appearance?.strokePattern).toBe("solid");
    expect(appearance?.cornerRadius).toBe(24);
  });
});
