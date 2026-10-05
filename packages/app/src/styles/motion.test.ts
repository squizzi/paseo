import { describe, expect, it } from "vitest";
import {
  CHAT_ENTRY_DURATION_MS,
  CHAT_ENTRY_SCALE_FROM,
  MOTION_ARRIVE_DURATION_MS,
  MOTION_ARRIVE_OFFSET_PX,
  MOTION_CLIP_AUTO,
  MOTION_CONTENT_DELAY_MS,
  MOTION_EXIT_DURATION_MS,
  MOTION_MICRO_OFFSET_PX,
  MOTION_OVERLAY_ARRIVE_DURATION_MS,
  MOTION_OVERLAY_EXIT_DURATION_MS,
  MOTION_STAGGER_MS,
  motionOverlayArriveFromAnchor,
  motionStaggerDelayMs,
  resolveArriveFadeStyle,
  resolveChatEntryFadeStyle,
  resolveGrowthClipFrameStyle,
  resolveSnapGrowthClipFrameStyle,
} from "./motion-tokens";

describe("motion overlay arrive offset", () => {
  it("starts closer to the anchor so the surface emerges into place", () => {
    expect(motionOverlayArriveFromAnchor("top")).toEqual({
      translateX: 0,
      translateY: MOTION_MICRO_OFFSET_PX,
    });
    expect(motionOverlayArriveFromAnchor("bottom")).toEqual({
      translateX: 0,
      translateY: -MOTION_MICRO_OFFSET_PX,
    });
    expect(motionOverlayArriveFromAnchor("left")).toEqual({
      translateX: MOTION_MICRO_OFFSET_PX,
      translateY: 0,
    });
    expect(motionOverlayArriveFromAnchor("right")).toEqual({
      translateX: -MOTION_MICRO_OFFSET_PX,
      translateY: 0,
    });
  });
});

describe("motion stagger", () => {
  it("offsets later siblings by a fixed step", () => {
    expect(motionStaggerDelayMs(0)).toBe(0);
    expect(motionStaggerDelayMs(1)).toBe(MOTION_STAGGER_MS);
    expect(motionStaggerDelayMs(2)).toBe(MOTION_STAGGER_MS * 2);
  });
});

describe("motion durations", () => {
  it("keeps exit quicker than arrive and overlays quicker than layout", () => {
    expect(MOTION_EXIT_DURATION_MS).toBeLessThan(MOTION_ARRIVE_DURATION_MS);
    expect(MOTION_OVERLAY_EXIT_DURATION_MS).toBeLessThan(MOTION_OVERLAY_ARRIVE_DURATION_MS);
    expect(MOTION_OVERLAY_ARRIVE_DURATION_MS).toBeLessThan(MOTION_ARRIVE_DURATION_MS);
    expect(CHAT_ENTRY_DURATION_MS).toBeGreaterThan(MOTION_ARRIVE_DURATION_MS);
    expect(MOTION_CONTENT_DELAY_MS).toBe(MOTION_STAGGER_MS);
  });
});

describe("arrive fade style", () => {
  it("rises from the offset and lands at rest", () => {
    expect(resolveArriveFadeStyle(0, MOTION_ARRIVE_OFFSET_PX)).toEqual({
      opacity: 0,
      transform: [{ translateY: MOTION_ARRIVE_OFFSET_PX }],
    });
    expect(resolveArriveFadeStyle(1, MOTION_ARRIVE_OFFSET_PX)).toEqual({
      opacity: 1,
      transform: [{ translateY: 0 }],
    });
  });
});

describe("chat entry fade style", () => {
  it("rises and scales up from a faint start to full rest", () => {
    expect(resolveChatEntryFadeStyle(0, MOTION_ARRIVE_OFFSET_PX)).toEqual({
      opacity: 0,
      transformOrigin: ["0%", "100%", 0],
      transform: [{ translateY: MOTION_ARRIVE_OFFSET_PX }, { scale: CHAT_ENTRY_SCALE_FROM }],
    });
    expect(resolveChatEntryFadeStyle(1, MOTION_ARRIVE_OFFSET_PX)).toEqual({
      opacity: 1,
      transformOrigin: ["0%", "100%", 0],
      transform: [{ translateY: 0 }, { scale: 1 }],
    });
  });

  it("emanates from the top right corner when origin is top-right", () => {
    expect(resolveChatEntryFadeStyle(0, MOTION_ARRIVE_OFFSET_PX, "top-right")).toEqual({
      opacity: 0,
      transformOrigin: ["100%", "0%", 0],
      transform: [{ translateY: MOTION_ARRIVE_OFFSET_PX }, { scale: CHAT_ENTRY_SCALE_FROM }],
    });
    expect(resolveChatEntryFadeStyle(1, MOTION_ARRIVE_OFFSET_PX, "top-right")).toEqual({
      opacity: 1,
      transformOrigin: ["100%", "0%", 0],
      transform: [{ translateY: 0 }, { scale: 1 }],
    });
  });
});

describe("growth clip frame style", () => {
  it("leaves the axis unconstrained until a measured size arrives", () => {
    expect(resolveGrowthClipFrameStyle(MOTION_CLIP_AUTO, "height")).toEqual({
      overflow: "visible",
      width: "auto",
      height: "auto",
    });
    expect(resolveGrowthClipFrameStyle(120, "height")).toEqual({
      overflow: "hidden",
      width: "auto",
      height: 120,
    });
    expect(resolveGrowthClipFrameStyle(80, "width")).toEqual({
      overflow: "hidden",
      width: 80,
      height: "auto",
    });
  });

  it("never returns undefined for the unconstrained axis, which reanimated's web diff treats as no change and leaves the prior pixel value stuck", () => {
    const style = resolveGrowthClipFrameStyle(MOTION_CLIP_AUTO, "height");
    expect(style.height).not.toBeUndefined();
    expect(style.width).not.toBeUndefined();
  });

  it("returns the same keys on every call so a reanimated web diff cannot leave a stale inline style", () => {
    const keys = (size: number) => Object.keys(resolveGrowthClipFrameStyle(size, "height")).sort();
    expect(keys(MOTION_CLIP_AUTO)).toEqual(keys(120));
  });

  it("does not clip snap growth so a stream fade cannot flash the bottom of a Thinking block", () => {
    expect(resolveSnapGrowthClipFrameStyle(MOTION_CLIP_AUTO)).toEqual({});
    expect(resolveSnapGrowthClipFrameStyle(120)).toEqual({ minHeight: 120 });
  });
});
