import { cancelAnimation, runOnJS, withTiming, type SharedValue } from "react-native-reanimated";
import {
  MOTION_ARRIVE_DURATION_MS,
  MOTION_ARRIVE_TIMING,
  MOTION_BURST_DURATION_MS,
  MOTION_BURST_TIMING,
} from "@/styles/motion";

export type CollapseClipResize = { action: "ignore" } | { action: "ease"; to: number };

/**
 * Shared expand policy for height and width clips: keep easing toward the latest
 * measured size, never snap back, and ignore layouts once settled or collapsing.
 */
export function resolveCollapseClipResize(input: {
  expanded: boolean;
  settledOpen: boolean;
  nextSize: number;
  targetSize: number;
}): CollapseClipResize {
  if (!input.expanded || input.settledOpen || input.nextSize <= 0) {
    return { action: "ignore" };
  }
  if (Math.abs(input.nextSize - input.targetSize) <= 0.5) {
    return { action: "ignore" };
  }
  return { action: "ease", to: input.nextSize };
}

export function applyCollapseClipResize(input: {
  expanded: boolean;
  settledOpen: boolean;
  nextSize: number;
  targetSizeRef: { current: number };
  size: SharedValue<number>;
  fromSentinel?: number;
  onSettled: () => void;
}): void {
  const decision = resolveCollapseClipResize({
    expanded: input.expanded,
    settledOpen: input.settledOpen,
    nextSize: input.nextSize,
    targetSize: input.targetSizeRef.current,
  });
  if (decision.action === "ignore") {
    return;
  }
  input.targetSizeRef.current = decision.to;
  cancelAnimation(input.size);
  if (input.size.value < 0) {
    const from = input.fromSentinel ?? 0;
    input.size.value = from > 0 ? from : 0;
  }
  const onSettled = input.onSettled;
  input.size.value = withTiming(decision.to, MOTION_ARRIVE_TIMING, (finished) => {
    if (finished) {
      runOnJS(onSettled)();
    }
  });
}

export interface ApplyGrowthSizeOptions {
  easeInitial?: boolean;
  resolveDuration?: (input: { inFlight: boolean; distancePx: number }) => number;
}

/**
 * Ease growth of a clip. First paint snaps unless `easeInitial`. Shrinks snap.
 * Continue from the in-flight size so a 60Hz retarget does not restart the ease.
 * Optional `resolveDuration` picks arrive vs burst for in-flight stream lumps.
 */
export function applyGrowthSize(
  size: SharedValue<number>,
  contentSizeRef: { current: number | null },
  nextSize: number,
  options?: ApplyGrowthSizeOptions,
): void {
  if (nextSize <= 0) {
    return;
  }
  const previousSize = contentSizeRef.current;
  if (previousSize !== null && Math.abs(nextSize - previousSize) <= 0.5) {
    return;
  }
  contentSizeRef.current = nextSize;
  if (previousSize === null) {
    cancelAnimation(size);
    if (options?.easeInitial) {
      size.value = 0;
      size.value = withTiming(nextSize, MOTION_ARRIVE_TIMING);
      return;
    }
    size.value = nextSize;
    return;
  }
  if (nextSize <= previousSize + 0.5) {
    cancelAnimation(size);
    size.value = nextSize;
    return;
  }
  cancelAnimation(size);
  const visualSize = size.value;
  const duration =
    options?.resolveDuration?.({
      inFlight: visualSize >= 0 && visualSize < previousSize - 0.5,
      distancePx: nextSize - Math.max(visualSize, 0),
    }) ?? MOTION_ARRIVE_DURATION_MS;
  size.value = withTiming(
    nextSize,
    duration === MOTION_BURST_DURATION_MS ? MOTION_BURST_TIMING : MOTION_ARRIVE_TIMING,
  );
}
