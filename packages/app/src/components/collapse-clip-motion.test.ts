import { describe, expect, it } from "vitest";
import { resolveCollapseClipResize } from "./collapse-clip-motion";

describe("collapse clip resize", () => {
  it("eases toward initial and later measurements when expanding", () => {
    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextSize: 80,
        targetSize: 0,
      }),
    ).toEqual({ action: "ease", to: 80 });

    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextSize: 160,
        targetSize: 80,
      }),
    ).toEqual({ action: "ease", to: 160 });

    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextSize: 120,
        targetSize: 160,
      }),
    ).toEqual({ action: "ease", to: 120 });
  });

  it("ignores measurements once settled open, while collapsing, or when they do not move", () => {
    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: true,
        nextSize: 200,
        targetSize: 160,
      }),
    ).toEqual({ action: "ignore" });

    expect(
      resolveCollapseClipResize({
        expanded: false,
        settledOpen: false,
        nextSize: 160,
        targetSize: 160,
      }),
    ).toEqual({ action: "ignore" });

    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextSize: 0,
        targetSize: 0,
      }),
    ).toEqual({ action: "ignore" });

    expect(
      resolveCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextSize: 100.2,
        targetSize: 100,
      }),
    ).toEqual({ action: "ignore" });
  });
});
