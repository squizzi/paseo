import { Keyframe, ReduceMotion } from "react-native-reanimated";
import {
  MOTION_ARRIVE_EASING,
  MOTION_EXIT_EASING,
  MOTION_OVERLAY_ARRIVE_DURATION_MS,
  MOTION_OVERLAY_EXIT_DURATION_MS,
  MOTION_OVERLAY_SCALE,
  motionOverlayArriveFromAnchor,
  type MotionOverlaySide,
} from "@/styles/motion";

function overlayKeyframe(input: {
  side: MotionOverlaySide;
  fromOpacity: number;
  toOpacity: number;
  scaleFrom: number;
  scaleTo: number;
  duration: number;
  easing: typeof MOTION_ARRIVE_EASING | typeof MOTION_EXIT_EASING;
}) {
  const from = motionOverlayArriveFromAnchor(input.side);
  const startX = input.fromOpacity === 0 ? from.translateX : 0;
  const startY = input.fromOpacity === 0 ? from.translateY : 0;
  const endX = input.toOpacity === 0 ? from.translateX : 0;
  const endY = input.toOpacity === 0 ? from.translateY : 0;
  return new Keyframe({
    0: {
      opacity: input.fromOpacity,
      transform: [{ translateX: startX }, { translateY: startY }, { scale: input.scaleFrom }],
    },
    100: {
      opacity: input.toOpacity,
      transform: [{ translateX: endX }, { translateY: endY }, { scale: input.scaleTo }],
      easing: input.easing,
    },
  })
    .duration(input.duration)
    .reduceMotion(ReduceMotion.System);
}

type OverlayKeyframe = ReturnType<typeof overlayKeyframe>;

function overlayMotionSet(scaleFrom: number): {
  entering: Record<MotionOverlaySide, OverlayKeyframe>;
  exiting: Record<MotionOverlaySide, OverlayKeyframe>;
} {
  const entering = {} as Record<MotionOverlaySide, OverlayKeyframe>;
  const exiting = {} as Record<MotionOverlaySide, OverlayKeyframe>;
  for (const side of ["top", "bottom", "left", "right"] as const) {
    entering[side] = overlayKeyframe({
      side,
      fromOpacity: 0,
      toOpacity: 1,
      scaleFrom,
      scaleTo: 1,
      duration: MOTION_OVERLAY_ARRIVE_DURATION_MS,
      easing: MOTION_ARRIVE_EASING,
    });
    exiting[side] = overlayKeyframe({
      side,
      fromOpacity: 1,
      toOpacity: 0,
      scaleFrom: 1,
      scaleTo: scaleFrom,
      duration: MOTION_OVERLAY_EXIT_DURATION_MS,
      easing: MOTION_EXIT_EASING,
    });
  }
  return { entering, exiting };
}

export const menuOverlayMotion = overlayMotionSet(MOTION_OVERLAY_SCALE);
export const tooltipOverlayMotion = overlayMotionSet(1);
