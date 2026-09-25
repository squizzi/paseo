import { describe, expect, it, vi } from "vitest";
import type { SharedValue } from "react-native-reanimated";

vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  Easing: {
    bezier: () => "arrive",
    in: (easing: unknown) => easing,
    cubic: "cubic",
  },
  ReduceMotion: { System: "system" },
  runOnJS: (fn: () => void) => fn,
  withTiming: vi.fn((value: unknown) => value),
}));

import { withTiming } from "react-native-reanimated";
import {
  MOTION_ARRIVE_DURATION_MS,
  MOTION_BURST_DURATION_MS,
  resolveStreamBurstDuration,
} from "@/styles/motion-tokens";
import {
  applyCollapseClipResize,
  applyGrowthSize,
  resolveCollapseClipResize,
} from "./collapse-clip-motion";

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

describe("apply collapse clip resize", () => {
  function createSize(initial: number): SharedValue<number> {
    let inner = initial;
    return {
      get value() {
        return inner;
      },
      set value(next: number) {
        inner = next;
      },
      get: () => inner,
      set: (value) => {
        inner = typeof value === "function" ? value(inner) : value;
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      modify: () => undefined,
    };
  }

  it("ignores a settled or empty measurement", () => {
    const size = createSize(80);
    const onSettled = vi.fn();
    vi.mocked(withTiming).mockClear();

    applyCollapseClipResize({
      expanded: true,
      settledOpen: true,
      nextSize: 120,
      targetSizeRef: { current: 80 },
      size,
      onSettled,
    });

    expect(vi.mocked(withTiming)).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("eases from a sentinel toward the measured size", () => {
    const size = createSize(-1);
    const targetSizeRef = { current: 0 };
    const onSettled = vi.fn();
    vi.mocked(withTiming).mockClear();

    applyCollapseClipResize({
      expanded: true,
      settledOpen: false,
      nextSize: 160,
      targetSizeRef,
      size,
      fromSentinel: 48,
      onSettled,
    });

    expect(size.value).toBe(160);
    expect(targetSizeRef.current).toBe(160);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      160,
      expect.objectContaining({ duration: MOTION_ARRIVE_DURATION_MS }),
      expect.any(Function),
    );
  });
});

describe("applyGrowthSize", () => {
  function createSize(initial: number): {
    writes: number[];
    size: SharedValue<number>;
  } {
    const writes: number[] = [];
    let inner = initial;
    const size: SharedValue<number> = {
      get value() {
        return inner;
      },
      set value(next: number) {
        writes.push(next);
        inner = next;
      },
      get: () => inner,
      set: (value) => {
        inner = typeof value === "function" ? value(inner) : value;
        writes.push(inner);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      modify: () => undefined,
    };
    return { writes, size };
  }

  it("eases a quiet wrap on the arrive window", () => {
    const { writes, size } = createSize(-1);
    const contentSizeRef = { current: null as number | null };

    applyGrowthSize(size, contentSizeRef, 100, { resolveDuration: resolveStreamBurstDuration });
    writes.length = 0;
    vi.mocked(withTiming).mockClear();
    applyGrowthSize(size, contentSizeRef, 118, { resolveDuration: resolveStreamBurstDuration });

    expect(writes).toEqual([118]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      118,
      expect.objectContaining({ duration: MOTION_ARRIVE_DURATION_MS }),
    );
  });

  it("eases a lump bigger than one line on the burst window", () => {
    const { writes, size } = createSize(-1);
    const contentSizeRef = { current: null as number | null };

    applyGrowthSize(size, contentSizeRef, 100, { resolveDuration: resolveStreamBurstDuration });
    writes.length = 0;
    vi.mocked(withTiming).mockClear();
    applyGrowthSize(size, contentSizeRef, 148, { resolveDuration: resolveStreamBurstDuration });

    expect(writes).toEqual([148]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      148,
      expect.objectContaining({ duration: MOTION_BURST_DURATION_MS }),
    );
  });

  it("eases an in-flight catch-up on the burst window", () => {
    const { writes, size } = createSize(-1);
    const contentSizeRef = { current: null as number | null };

    applyGrowthSize(size, contentSizeRef, 100, { resolveDuration: resolveStreamBurstDuration });
    size.value = 52;
    writes.length = 0;
    vi.mocked(withTiming).mockClear();
    applyGrowthSize(size, contentSizeRef, 140, { resolveDuration: resolveStreamBurstDuration });

    expect(writes).toEqual([140]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      140,
      expect.objectContaining({ duration: MOTION_BURST_DURATION_MS }),
    );
  });

  it("keeps arrive when duration is not resolved, even for a lump", () => {
    const { writes, size } = createSize(-1);
    const contentSizeRef = { current: null as number | null };

    applyGrowthSize(size, contentSizeRef, 100);
    writes.length = 0;
    vi.mocked(withTiming).mockClear();
    applyGrowthSize(size, contentSizeRef, 148);

    expect(writes).toEqual([148]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      148,
      expect.objectContaining({ duration: MOTION_ARRIVE_DURATION_MS }),
    );
  });

  it("eases the first measurement from zero when the clip is revealing details", () => {
    const { writes, size } = createSize(-1);
    const contentSizeRef = { current: null as number | null };
    vi.mocked(withTiming).mockClear();

    applyGrowthSize(size, contentSizeRef, 80, { easeInitial: true });

    expect(writes).toEqual([0, 80]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      80,
      expect.objectContaining({ duration: MOTION_ARRIVE_DURATION_MS }),
    );
  });
});
