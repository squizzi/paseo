import { describe, expect, it } from "vitest";
import { readObservedAxisSize } from "./use-observed-size";

describe("readObservedAxisSize", () => {
  it("uses the border box so text leading is not dropped from the clip", () => {
    expect(
      readObservedAxisSize({
        axis: "height",
        borderBoxSize: [{ blockSize: 21.4, inlineSize: 320 }],
        fallback: 18,
      }),
    ).toBe(21.4);
  });

  it("falls back when the border box is missing or zero", () => {
    expect(
      readObservedAxisSize({
        axis: "height",
        fallback: 42,
      }),
    ).toBe(42);
    expect(
      readObservedAxisSize({
        axis: "width",
        borderBoxSize: [{ blockSize: 21, inlineSize: 0 }],
        fallback: 80,
      }),
    ).toBe(80);
  });
});
