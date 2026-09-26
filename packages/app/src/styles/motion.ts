import { Easing, ReduceMotion } from "react-native-reanimated";
import {
  CHAT_ENTRY_DURATION_MS,
  MOTION_ARRIVE_DURATION_MS,
  MOTION_BURST_DURATION_MS,
  MOTION_CROSSFADE_DURATION_MS,
  MOTION_EXIT_DURATION_MS,
  MOTION_HOVER_DURATION_MS,
} from "./motion-tokens";

export {
  CHAT_ENTRY_CSS,
  CHAT_ENTRY_DURATION_MS,
  CHAT_ENTRY_SCALE_FROM,
  MOTION_ARRIVE_CSS,
  MOTION_ARRIVE_DURATION_MS,
  MOTION_ARRIVE_OFFSET_PX,
  MOTION_BURST_DURATION_MS,
  MOTION_BURST_HEIGHT_PX,
  MOTION_CONTENT_DELAY_MS,
  MOTION_CROSSFADE_DURATION_MS,
  MOTION_EXIT_CSS,
  MOTION_EXIT_DURATION_MS,
  MOTION_HOVER_DURATION_MS,
  MOTION_HOVER_SCALE,
  MOTION_CLIP_AUTO,
  MOTION_MICRO_OFFSET_PX,
  MOTION_OVERLAY_ARRIVE_DURATION_MS,
  MOTION_OVERLAY_EXIT_DURATION_MS,
  MOTION_OVERLAY_SCALE,
  MOTION_PRESS_SCALE,
  MOTION_STAGGER_MS,
  motionOverlayArriveFromAnchor,
  motionStaggerDelayMs,
  resolveArriveFadeStyle,
  resolveChatEntryFadeStyle,
  resolveGrowthClipFrameStyle,
  resolveStreamBurstDuration,
  type ArriveFadeStyle,
  type ChatEntryFadeStyle,
  type GrowthClipAxis,
  type GrowthClipFrameStyle,
  type MotionOverlaySide,
  type MotionTranslate,
} from "./motion-tokens";

/**
 * Shared Reanimated curves. One curve per job so sidebar, overlays, and
 * expand/collapse do not invent their own timings. Chat row arrival is the
 * one exception (`CHAT_ENTRY_TIMING` below): it carries its own slower,
 * softer curve plus a scale so a sent or arriving row reads with more
 * weight than the snappier arrive used for badge/overlay chrome.
 *
 * Arrive is a fast attack with a soft land. Exit is quicker than the open and
 * never overshoots. Springs are for pointer scale only — height and width stay
 * on timing so layout cannot bounce.
 */

export const MOTION_ARRIVE_EASING = Easing.bezier(0.16, 1, 0.3, 1);
export const MOTION_EXIT_EASING = Easing.in(Easing.cubic);

export const MOTION_ARRIVE_TIMING = {
  duration: MOTION_ARRIVE_DURATION_MS,
  easing: MOTION_ARRIVE_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

export const CHAT_ENTRY_EASING = Easing.bezier(0.22, 1, 0.36, 1);

export const CHAT_ENTRY_TIMING = {
  duration: CHAT_ENTRY_DURATION_MS,
  easing: CHAT_ENTRY_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

export const MOTION_EXIT_TIMING = {
  duration: MOTION_EXIT_DURATION_MS,
  easing: MOTION_EXIT_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

export const MOTION_BURST_TIMING = {
  duration: MOTION_BURST_DURATION_MS,
  easing: MOTION_ARRIVE_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

export const MOTION_HOVER_TIMING = {
  duration: MOTION_HOVER_DURATION_MS,
  easing: MOTION_ARRIVE_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

export const MOTION_CROSSFADE_TIMING = {
  duration: MOTION_CROSSFADE_DURATION_MS,
  easing: MOTION_ARRIVE_EASING,
  reduceMotion: ReduceMotion.System,
} as const;

/** Light press spring: small overshoot, then rest. */
export const MOTION_PRESS_SPRING = {
  damping: 18,
  stiffness: 420,
  mass: 0.5,
  overshootClamping: false,
  reduceMotion: ReduceMotion.System,
} as const;
