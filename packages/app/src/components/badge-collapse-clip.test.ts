import { describe, expect, it } from "vitest";
import {
  BADGE_COLLAPSE_AUTO_HEIGHT,
  BADGE_COLLAPSE_DURATION_MS,
  resolveBadgeCollapseClipFrameStyle,
  resolveBadgeCollapseClipResize,
} from "./badge-collapse-motion";

describe("badge collapse clip resize", () => {
  it("eases toward initial and later measurements when expanding", () => {
    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: 80,
        targetHeight: 0,
      }),
    ).toEqual({ action: "ease", to: 80 });

    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: 160,
        targetHeight: 80,
      }),
    ).toEqual({ action: "ease", to: 160 });

    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: 120,
        targetHeight: 160,
      }),
    ).toEqual({ action: "ease", to: 120 });
  });

  it("ignores measurements once settled open", () => {
    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: true,
        nextHeight: 200,
        targetHeight: 160,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores measurements while collapsing or collapsed", () => {
    expect(
      resolveBadgeCollapseClipResize({
        expanded: false,
        settledOpen: false,
        nextHeight: 160,
        targetHeight: 160,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores non-positive measurements or negligible differences", () => {
    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: 0,
        targetHeight: 0,
      }),
    ).toEqual({ action: "ignore" });

    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: -10,
        targetHeight: 0,
      }),
    ).toEqual({ action: "ignore" });

    expect(
      resolveBadgeCollapseClipResize({
        expanded: true,
        settledOpen: false,
        nextHeight: 100.2,
        targetHeight: 100,
      }),
    ).toEqual({ action: "ignore" });
  });
});

describe("badge collapse clip frame style", () => {
  it("clips with explicit height while expanding or collapsing", () => {
    expect(resolveBadgeCollapseClipFrameStyle(120)).toEqual({
      height: 120,
      overflow: "hidden",
    });

    expect(resolveBadgeCollapseClipFrameStyle(0)).toEqual({
      height: 0,
      overflow: "hidden",
    });
  });

  it("leaves height unconstrained while preserving overflow hidden when settled open", () => {
    expect(resolveBadgeCollapseClipFrameStyle(BADGE_COLLAPSE_AUTO_HEIGHT)).toEqual({
      overflow: "hidden",
    });
  });
});

describe("badge collapse clip timing", () => {
  it("matches the 160ms chat entry duration", () => {
    expect(BADGE_COLLAPSE_DURATION_MS).toBe(160);
  });
});
