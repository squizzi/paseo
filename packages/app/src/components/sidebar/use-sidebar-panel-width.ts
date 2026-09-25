import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION_ARRIVE_TIMING, MOTION_EXIT_TIMING } from "@/styles/motion";
import {
  resolveSidebarPanelFrameStyle,
  resolveSidebarPanelInnerLock,
  resolveSidebarPanelWidthCause,
  resolveSidebarPanelWidthMotion,
  sidebarPanelOccupiesLayout,
} from "@/components/sidebar/panel-motion";

export function useSidebarPanelWidth(input: {
  open: boolean;
  openWidth: number;
  onOccupiesLayoutChange?: (occupies: boolean) => void;
}) {
  const reducedMotion = useReducedMotion() === true;
  const width = useSharedValue(input.open ? input.openWidth : 0);
  const lockInner = useSharedValue(false);
  const lockedInnerWidth = useSharedValue(input.openWidth);
  const hasPaintedRef = useRef(false);
  const openRef = useRef(input.open);
  const [closing, setClosing] = useState(false);

  const markCloseSettled = useCallback(() => {
    if (openRef.current) {
      return;
    }
    lockInner.value = false;
    setClosing(false);
  }, [lockInner]);

  const unlockInner = useCallback(() => {
    lockInner.value = false;
  }, [lockInner]);

  useLayoutEffect(() => {
    const cause = resolveSidebarPanelWidthCause({
      hasPainted: hasPaintedRef.current,
      openChanged: input.open !== openRef.current,
    });
    const wasOpen = openRef.current;
    hasPaintedRef.current = true;
    openRef.current = input.open;

    if (input.open) {
      setClosing(false);
    } else if (wasOpen && cause === "toggle" && !reducedMotion) {
      setClosing(true);
    }

    const innerLock = resolveSidebarPanelInnerLock({
      cause,
      open: input.open,
      openWidth: input.openWidth,
      currentWidth: width.value,
    });
    lockedInnerWidth.value = innerLock.width;
    lockInner.value = innerLock.lock;

    const decision = resolveSidebarPanelWidthMotion({
      open: input.open,
      openWidth: input.openWidth,
      currentWidth: width.value,
      reducedMotion,
      cause,
    });
    if (decision.action === "ignore") {
      lockInner.value = false;
      return;
    }
    cancelAnimation(width);
    if (decision.action === "snap") {
      width.value = decision.to;
      lockInner.value = false;
      if (!input.open) {
        setClosing(false);
      }
      return;
    }
    width.value = decision.from;
    const timing = decision.curve === "arrive" ? MOTION_ARRIVE_TIMING : MOTION_EXIT_TIMING;
    width.value = withTiming(decision.to, timing, (finished) => {
      if (!finished) {
        return;
      }
      if (decision.curve === "exit") {
        runOnJS(markCloseSettled)();
        return;
      }
      runOnJS(unlockInner)();
    });
  }, [
    input.open,
    input.openWidth,
    lockInner,
    lockedInnerWidth,
    markCloseSettled,
    reducedMotion,
    unlockInner,
    width,
  ]);

  const occupiesLayout = sidebarPanelOccupiesLayout({ open: input.open, closing });
  const onOccupiesLayoutChange = input.onOccupiesLayoutChange;
  useLayoutEffect(() => {
    onOccupiesLayoutChange?.(occupiesLayout);
  }, [occupiesLayout, onOccupiesLayoutChange]);

  const frameStyle = useAnimatedStyle(() => resolveSidebarPanelFrameStyle(width.value));
  const innerStyle = useAnimatedStyle(() => ({
    width: lockInner.value ? lockedInnerWidth.value : width.value,
    flex: 1,
    minHeight: 0,
  }));

  return {
    width,
    frameStyle,
    innerStyle,
    occupiesLayout,
    closing,
  };
}
