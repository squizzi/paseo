import { describe, expect, it } from "vitest";
import {
  BADGE_COLLAPSE_AUTO_HEIGHT,
  resolveBadgeCollapseClipFrameStyle,
} from "./badge-collapse-motion";

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
