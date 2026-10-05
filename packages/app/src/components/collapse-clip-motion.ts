import type { ViewStyle } from "react-native";
import { cancelAnimation, runOnJS, withTiming, type SharedValue } from "react-native-reanimated";
import { MOTION_ARRIVE_TIMING } from "@/styles/motion";

export type CollapseClipResize = { action: "ignore" } | { action: "ease"; to: number };

/** Expanding details must grow the transcript. flexShrink would collapse them to leftover space. */
export const COLLAPSE_CLIP_FRAME_LAYOUT = { flexShrink: 0 } as const;

export interface CollapseClipInnerStyle {
  position?: "absolute";
  left?: number;
  right?: number;
  top?: number;
  height?: ViewStyle["height"];
}

export function scrollExpandedClipIntoNearestView(node: unknown): void {
  if (!(typeof HTMLElement === "function" && node instanceof HTMLElement)) {
    return;
  }
  node.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/**
 * Expanding details sit in a 0-height overflow clip. Size the inner to its
 * content or a flex-grow ScrollView (shell output, grouped tool calls) measures
 * 0 and the panel never opens.
 */
export function resolveCollapseClipInnerStyle(input: {
  settledOpen: boolean;
  sizeToContent: boolean;
}): CollapseClipInnerStyle {
  const sizeStyle = input.sizeToContent
    ? { height: "max-content" as unknown as ViewStyle["height"] }
    : {};
  if (input.settledOpen) {
    return sizeStyle;
  }
  return {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    ...sizeStyle,
  };
}

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
}

/**
 * Snap growth of a clip. First paint snaps unless `easeInitial`. Shrinks snap.
 * Easing height leaves the clip edge mid-line; the web fade already smooths arrival.
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
  const targetSize = Math.ceil(nextSize);
  const previousSize = contentSizeRef.current;
  if (previousSize !== null && Math.abs(targetSize - previousSize) <= 0.5) {
    return;
  }
  contentSizeRef.current = targetSize;
  if (previousSize === null) {
    cancelAnimation(size);
    if (options?.easeInitial) {
      size.value = 0;
      size.value = withTiming(targetSize, MOTION_ARRIVE_TIMING);
      return;
    }
    size.value = targetSize;
    return;
  }
  cancelAnimation(size);
  size.value = targetSize;
}
