import { describe, expect, it } from "vitest";
import {
  MOTION_ARRIVE_DURATION_MS,
  MOTION_BURST_DURATION_MS,
  MOTION_BURST_HEIGHT_PX,
  MOTION_CONTENT_DELAY_MS,
  MOTION_EXIT_DURATION_MS,
  MOTION_MICRO_OFFSET_PX,
  MOTION_OVERLAY_ARRIVE_DURATION_MS,
  MOTION_OVERLAY_EXIT_DURATION_MS,
  MOTION_STAGGER_MS,
  motionOverlayArriveFromAnchor,
  motionStaggerDelayMs,
  resolveStreamBurstDuration,
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
    expect(MOTION_BURST_DURATION_MS).toBeLessThan(MOTION_ARRIVE_DURATION_MS);
    expect(MOTION_CONTENT_DELAY_MS).toBe(MOTION_STAGGER_MS);
  });
});

describe("stream burst duration", () => {
  it("keeps a quiet wrap on the arrive window", () => {
    expect(
      resolveStreamBurstDuration({
        inFlight: false,
        distancePx: MOTION_BURST_HEIGHT_PX - 1,
      }),
    ).toBe(MOTION_ARRIVE_DURATION_MS);
  });

  it("uses the burst window for an in-flight catch-up or a lump", () => {
    expect(
      resolveStreamBurstDuration({
        inFlight: true,
        distancePx: 8,
      }),
    ).toBe(MOTION_BURST_DURATION_MS);
    expect(
      resolveStreamBurstDuration({
        inFlight: false,
        distancePx: MOTION_BURST_HEIGHT_PX,
      }),
    ).toBe(MOTION_BURST_DURATION_MS);
  });

  it("keeps a whole-row insert on the quiet window when distance is omitted", () => {
    expect(resolveStreamBurstDuration({ inFlight: false })).toBe(MOTION_ARRIVE_DURATION_MS);
    expect(
      resolveStreamBurstDuration({
        inFlight: false,
        quietDurationMs: 160,
      }),
    ).toBe(160);
  });
});
