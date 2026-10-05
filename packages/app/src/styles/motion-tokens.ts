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
/**
 * Newly streamed text fade-in on web. Each coalesced arrival mounts as one
 * frozen span with a CSS opacity keyframe over this duration.
 * Independent of growth-clip timing so it cannot lag the stream.
 */
export const MOTION_STREAM_WORD_FADE_DURATION_MS = 400;

/** Chat row arrival and matching CSS chrome. Softer and slower than arrive. */
export const CHAT_ENTRY_DURATION_MS = 320;
export const CHAT_ENTRY_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

export const MOTION_ARRIVE_OFFSET_PX = 6;
export const MOTION_MICRO_OFFSET_PX = 4;
/** Shared-value sentinel: do not constrain this axis so content can reflow. */
export const MOTION_CLIP_AUTO = -1;

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

/** Opacity plus a short rise. Badge details land with this. */
export function resolveArriveFadeStyle(progress: number, offsetPx: number): ArriveFadeStyle {
  "worklet";
  return {
    opacity: progress,
    transform: [{ translateY: offsetPx * (1 - progress) }],
  };
}

/** Barely-perceptible scale-up alongside the rise, so it doesn't shrink the arrive offset. */
export const CHAT_ENTRY_SCALE_FROM = 0.98;

export type ChatMotionOrigin = "top-right" | "bottom-left";

export interface ChatEntryFadeStyle {
  opacity: number;
  transformOrigin: [string, string, number];
  transform: [{ translateY: number }, { scale: number }];
}

/** Chat row arrival: fade, rise, and a faint scale-up for weight. */
export function resolveChatEntryFadeStyle(
  progress: number,
  offsetPx: number,
  origin: ChatMotionOrigin = "bottom-left",
): ChatEntryFadeStyle {
  "worklet";
  const transformOrigin: [string, string, number] =
    origin === "top-right" ? ["100%", "0%", 0] : ["0%", "100%", 0];
  return {
    opacity: progress,
    transformOrigin,
    transform: [
      { translateY: offsetPx * (1 - progress) },
      { scale: CHAT_ENTRY_SCALE_FROM + (1 - CHAT_ENTRY_SCALE_FROM) * progress },
    ],
  };
}

export type GrowthClipAxis = "width" | "height";

export interface GrowthClipFrameStyle {
  overflow: "hidden" | "visible";
  width: number | "auto";
  height: number | "auto";
}

/**
 * Always returns the same set of keys, and never `undefined` for the
 * unconstrained axis. `useAnimatedStyle` diffs style objects across frames on
 * web: a key whose value turns from a real number to `undefined` is treated
 * as "no change" and the prior inline pixel value is left on the DOM node
 * instead of being cleared. Returning the literal `"auto"` forces the style
 * to actually update.
 */
export function resolveGrowthClipFrameStyle(
  size: number,
  axis: GrowthClipAxis,
): GrowthClipFrameStyle {
  "worklet";
  if (size < 0) {
    return { overflow: "visible", width: "auto", height: "auto" };
  }
  if (axis === "width") {
    return { overflow: "hidden", width: size, height: "auto" };
  }
  return { overflow: "hidden", width: "auto", height: size };
}

export interface SnapGrowthClipFrameStyle {
  minHeight?: number;
}

/** Streaming snap: floor the box, never clip paint. Pixel height + overflow hidden flashes the last line. */
export function resolveSnapGrowthClipFrameStyle(size: number): SnapGrowthClipFrameStyle {
  "worklet";
  if (size < 0) {
    return {};
  }
  return { minHeight: size };
}
