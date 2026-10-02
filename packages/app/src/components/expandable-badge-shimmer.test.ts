import { describe, expect, it } from "vitest";
import {
  computeShimmerMetrics,
  retainShimmerLoopFields,
  type ShimmerLoopFields,
} from "./expandable-badge-shimmer";

function loopFields(overrides: Partial<ShimmerLoopFields> = {}): ShimmerLoopFields {
  return {
    durationSeconds: 1.05,
    peakWidth: 42,
    trackStart: 0,
    trackEnd: 120,
    rowWidth: 160,
    rowHeight: 20,
    ...overrides,
  };
}

describe("retainShimmerLoopFields", () => {
  it("keeps the original duration/peak width/track start/row size while loading so extra words do not restart it", () => {
    const retained = loopFields();
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: true,
      live: loopFields({ durationSeconds: 1.6, peakWidth: 88, trackStart: 30, rowWidth: 320 }),
      retained,
    });
    expect(result).toEqual(retained);
  });

  it("does not lock in a pre-layout snapshot, even one with a nonzero floored peak width", () => {
    const prelayout = loopFields({ peakWidth: 32, rowWidth: 0, rowHeight: 0 });
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: false,
      live: prelayout,
      retained: null,
    });
    expect(result).toBeNull();
  });

  it("locks in the first genuinely measured snapshot once layout reports real dimensions", () => {
    const measured = loopFields({ rowWidth: 180, rowHeight: 20 });
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: true,
      live: measured,
      retained: null,
    });
    expect(result).toEqual(measured);
  });

  it("captures the first loading fields and clears them once idle", () => {
    expect(
      retainShimmerLoopFields({
        isLoading: true,
        isMeasured: true,
        live: loopFields(),
        retained: null,
      }),
    ).toEqual(loopFields());
    expect(
      retainShimmerLoopFields({
        isLoading: false,
        isMeasured: true,
        live: loopFields({ durationSeconds: 1.6 }),
        retained: loopFields(),
      }),
    ).toBeNull();
  });

  it("lets the track end grow forward as the summary grows", () => {
    const retained = loopFields({ trackEnd: 120 });
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: true,
      live: loopFields({ trackEnd: 180 }),
      retained,
    });
    expect(result?.trackEnd).toBe(180);
  });

  it("does not pull the track end back when a replaced summary measures narrower", () => {
    const retained = loopFields({ trackEnd: 180 });
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: true,
      live: loopFields({ trackEnd: 90 }),
      retained,
    });
    expect(result?.trackEnd).toBe(180);
  });

  it("freezes the native row width/height once measured so later layout passes do not restart the Reanimated loop", () => {
    const retained = loopFields({ rowWidth: 160, rowHeight: 20 });
    const result = retainShimmerLoopFields({
      isLoading: true,
      isMeasured: true,
      live: loopFields({ rowWidth: 240, rowHeight: 24 }),
      retained,
    });
    expect(result?.rowWidth).toBe(160);
    expect(result?.rowHeight).toBe(20);
  });
});

describe("computeShimmerMetrics", () => {
  it("lengthens the live duration as the label grows", () => {
    const short = computeShimmerMetrics({
      label: "Thinking",
      secondaryLabel: undefined,
      isLoading: true,
      isWeb: true,
      isNative: false,
      labelRowWidth: 80,
      labelRowHeight: 20,
      labelOffsetX: 0,
      labelWidth: 80,
      secondaryOffsetX: 0,
      secondaryWidth: 0,
    });
    const long = computeShimmerMetrics({
      label: "Ran 1 command, read 1 file and searched 1 time",
      secondaryLabel: undefined,
      isLoading: true,
      isWeb: true,
      isNative: false,
      labelRowWidth: 320,
      labelRowHeight: 20,
      labelOffsetX: 0,
      labelWidth: 320,
      secondaryOffsetX: 0,
      secondaryWidth: 0,
    });
    expect(long.sweep.durationSeconds).toBeGreaterThan(short.sweep.durationSeconds);
  });

  it("reports unmeasured on native before the row has a layout, measured once it does", () => {
    const base = {
      label: "Running",
      secondaryLabel: undefined,
      isLoading: true,
      isWeb: false,
      isNative: true,
      labelOffsetX: 0,
      labelWidth: 0,
      secondaryOffsetX: 0,
      secondaryWidth: 0,
    };
    expect(computeShimmerMetrics({ ...base, labelRowWidth: 0, labelRowHeight: 0 }).isMeasured).toBe(
      false,
    );
    expect(
      computeShimmerMetrics({ ...base, labelRowWidth: 160, labelRowHeight: 20 }).isMeasured,
    ).toBe(true);
  });
});
