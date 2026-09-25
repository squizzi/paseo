import { describe, expect, it } from "vitest";
import {
  computeShimmerMetrics,
  retainShimmerSweep,
  type ShimmerSweep,
} from "./expandable-badge-shimmer";

function liveSweep(overrides: Partial<ShimmerSweep> = {}): ShimmerSweep {
  return {
    durationSeconds: 1.05,
    peakWidth: 42,
    trackStart: -42,
    trackEnd: 80,
    ...overrides,
  };
}

describe("retainShimmerSweep", () => {
  it("keeps the original sweep while loading so extra words do not restart it", () => {
    const retained = liveSweep();
    expect(
      retainShimmerSweep({
        isLoading: true,
        live: liveSweep({ durationSeconds: 1.6, peakWidth: 88, trackEnd: 240 }),
        retained,
      }),
    ).toEqual(retained);
  });

  it("replaces a zero-width first capture once layout is known", () => {
    const unmeasured = liveSweep({ peakWidth: 0, trackEnd: 0 });
    const measured = liveSweep({ peakWidth: 42, trackEnd: 80 });
    expect(
      retainShimmerSweep({
        isLoading: true,
        live: measured,
        retained: unmeasured,
      }),
    ).toEqual(measured);
  });

  it("captures the first loading sweep and clears it once idle", () => {
    expect(
      retainShimmerSweep({
        isLoading: true,
        live: liveSweep(),
        retained: null,
      }),
    ).toEqual(liveSweep());
    expect(
      retainShimmerSweep({
        isLoading: false,
        live: liveSweep({ durationSeconds: 1.6 }),
        retained: liveSweep(),
      }),
    ).toBeNull();
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
});
