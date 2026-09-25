/**
 * Numeric and CSS motion tokens with no Reanimated import. Chrome that only
 * paints hover with CSS uses this file so tests that mock `react-native` do
 * not load Reanimated.
 *
 * Reanimated curves and timing objects live in `motion.ts` and re-export these.
 */

export const MOTION_ARRIVE_DURATION_MS = 200;
export const MOTION_ARRIVE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

export const MOTION_EXIT_DURATION_MS = 120;
export const MOTION_EXIT_CSS = "cubic-bezier(0.4, 0, 1, 1)";

export const MOTION_OVERLAY_ARRIVE_DURATION_MS = 160;
export const MOTION_OVERLAY_EXIT_DURATION_MS = 100;

export const MOTION_HOVER_DURATION_MS = 150;
export const MOTION_CROSSFADE_DURATION_MS = 120;
export const MOTION_CONTENT_DELAY_MS = 40;
export const MOTION_STAGGER_MS = 40;
/** In-flight stream growth: keep clipping, finish faster than a quiet wrap. */
export const MOTION_BURST_DURATION_MS = 80;
/** About one content line. Bigger jumps are a lump, not a wrap. */
export const MOTION_BURST_HEIGHT_PX = 28;

export const MOTION_ARRIVE_OFFSET_PX = 6;
export const MOTION_MICRO_OFFSET_PX = 4;
/** Shared-value sentinel: do not constrain this axis so content can reflow. */
export const MOTION_CLIP_AUTO = -1;

/**
 * Quiet wraps keep the arrive window. A catch-up or a lump bigger than one
 * line uses the burst window so the clip does not restart 200ms on every token.
 * Omit `distancePx` when the jump is a whole row insert, not a stream lump —
 * a user message should keep the quiet window.
 */
export function resolveStreamBurstDuration(input: {
  inFlight: boolean;
  distancePx?: number;
  quietDurationMs?: number;
}): number {
  const quietDurationMs = input.quietDurationMs ?? MOTION_ARRIVE_DURATION_MS;
  if (input.inFlight) {
    return MOTION_BURST_DURATION_MS;
  }
  if (input.distancePx !== undefined && input.distancePx >= MOTION_BURST_HEIGHT_PX) {
    return MOTION_BURST_DURATION_MS;
  }
  return quietDurationMs;
}

export const MOTION_HOVER_SCALE = 1.04;
export const MOTION_PRESS_SCALE = 0.96;
export const MOTION_OVERLAY_SCALE = 0.97;

export type MotionOverlaySide = "top" | "bottom" | "left" | "right";

export interface MotionTranslate {
  translateX: number;
  translateY: number;
}

/** Overlay starts closer to its anchor and settles into place. */
export function motionOverlayArriveFromAnchor(side: MotionOverlaySide): MotionTranslate {
  if (side === "top") {
    return { translateX: 0, translateY: MOTION_MICRO_OFFSET_PX };
  }
  if (side === "bottom") {
    return { translateX: 0, translateY: -MOTION_MICRO_OFFSET_PX };
  }
  if (side === "left") {
    return { translateX: MOTION_MICRO_OFFSET_PX, translateY: 0 };
  }
  return { translateX: -MOTION_MICRO_OFFSET_PX, translateY: 0 };
}

export function motionStaggerDelayMs(index: number): number {
  return index * MOTION_STAGGER_MS;
}

export interface ArriveFadeStyle {
  opacity: number;
  transform: [{ translateY: number }];
}

/** Opacity plus a short rise. Chat rows and badge details share this land. */
export function resolveArriveFadeStyle(progress: number, offsetPx: number): ArriveFadeStyle {
  "worklet";
  return {
    opacity: progress,
    transform: [{ translateY: offsetPx * (1 - progress) }],
  };
}

export type GrowthClipAxis = "width" | "height";

export interface GrowthClipFrameStyle {
  overflow: "hidden";
  width?: number;
  height?: number;
}

export function resolveGrowthClipFrameStyle(
  size: number,
  axis: GrowthClipAxis,
): GrowthClipFrameStyle {
  "worklet";
  if (size < 0) {
    return { overflow: "hidden" };
  }
  if (axis === "width") {
    return { width: size, overflow: "hidden" };
  }
  return { height: size, overflow: "hidden" };
}
