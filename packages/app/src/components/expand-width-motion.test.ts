import { describe, expect, it } from "vitest";
import { MOTION_CLIP_AUTO } from "@/styles/motion-tokens";
import {
  EXPAND_WIDTH_FILL,
  resolveExpandWidthFrameStyle,
  shouldStretchExpandWidthTrack,
} from "./expand-width-motion";

describe("expand width frame style", () => {
  it("clips to an explicit width while expanding or collapsing", () => {
    expect(resolveExpandWidthFrameStyle(180)).toEqual({
      width: 180,
      maxWidth: "100%",
      overflow: "hidden",
    });
  });

  it("fills the track once settled open and releases once collapsed", () => {
    expect(resolveExpandWidthFrameStyle(EXPAND_WIDTH_FILL)).toEqual({
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
    });
    expect(resolveExpandWidthFrameStyle(MOTION_CLIP_AUTO)).toEqual({
      maxWidth: "100%",
      overflow: "visible",
    });
  });
});

describe("expand width track stretch", () => {
  it("keeps the track at content width until the clip is locked to that width", () => {
    expect(
      shouldStretchExpandWidthTrack({
        expanded: true,
        sizeLocked: false,
        closing: false,
      }),
    ).toBe(false);
  });

  it("stretches after lock and stays stretched while collapsing", () => {
    expect(
      shouldStretchExpandWidthTrack({
        expanded: true,
        sizeLocked: true,
        closing: false,
      }),
    ).toBe(true);
    expect(
      shouldStretchExpandWidthTrack({
        expanded: false,
        sizeLocked: true,
        closing: true,
      }),
    ).toBe(true);
  });
});
