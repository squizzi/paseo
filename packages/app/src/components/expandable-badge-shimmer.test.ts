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
    ...overrides,
  };
}

describe("retainShimmerLoopFields", () => {
  it("keeps the original duration/peak width while loading so extra words do not restart it", () => {
    const retained = loopFields();
    expect(
      retainShimmerLoopFields({
        isLoading: true,
        live: loopFields({ durationSeconds: 1.6, peakWidth: 88 }),
        retained,
      }),
    ).toEqual(retained);
  });

  it("replaces a zero-width first capture once layout is known", () => {
    const unmeasured = loopFields({ peakWidth: 0 });
    const measured = loopFields({ peakWidth: 42 });
    expect(
      retainShimmerLoopFields({
        isLoading: true,
        live: measured,
        retained: unmeasured,
      }),
    ).toEqual(measured);
  });

  it("captures the first loading fields and clears them once idle", () => {
    expect(
      retainShimmerLoopFields({
        isLoading: true,
        live: loopFields(),
        retained: null,
      }),
    ).toEqual(loopFields());
    expect(
      retainShimmerLoopFields({
        isLoading: false,
        live: loopFields({ durationSeconds: 1.6 }),
        retained: loopFields(),
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
