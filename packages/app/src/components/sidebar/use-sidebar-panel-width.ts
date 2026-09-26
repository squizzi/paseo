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
import { useAnimationsEnabled } from "@/hooks/use-settings";
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
  /**
   * Settings replaces this panel with its own fixed-width sidebar that
   * visually covers the same spot. Entering/leaving settings toggles `open`
   * the same way a user click would, but there is nothing to animate --
   * the settings sidebar already occupies that space the instant it mounts,
   * so easing this panel open or closed underneath it is wasted motion on
   * an element nobody can see. Snap instead, on whichever render crosses the
   * boundary in either direction.
   */
  isSettingsRoute?: boolean;
}) {
  const animationsEnabled = useAnimationsEnabled();
  const reducedMotion = useReducedMotion() === true || !animationsEnabled;
  const width = useSharedValue(input.open ? input.openWidth : 0);
  const lockInner = useSharedValue(false);
  const lockedInnerWidth = useSharedValue(input.openWidth);
  const hasPaintedRef = useRef(false);
  const openRef = useRef(input.open);
  const wasSettingsRouteRef = useRef(input.isSettingsRoute ?? false);
  // Keeps the dock mounted/reserved through the close animation (see
  // split-container.tsx's explorer dock). Corner-ownership timing below does
  // NOT use this -- it needs to flip at the start of a close, not the end.
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
    const isSettingsRoute = input.isSettingsRoute ?? false;
    // True on the render that crosses the boundary in either direction:
    // entering settings sees the new `true`, leaving it still sees the old
    // one via the ref, since `open` and `isSettingsRoute` flip together.
    const crossingSettingsBoundary = isSettingsRoute || wasSettingsRouteRef.current;
    wasSettingsRouteRef.current = isSettingsRoute;
    const skipMotion = reducedMotion || crossingSettingsBoundary;

    const cause = resolveSidebarPanelWidthCause({
      hasPainted: hasPaintedRef.current,
      openChanged: input.open !== openRef.current,
    });
    const wasOpen = openRef.current;
    hasPaintedRef.current = true;
    openRef.current = input.open;

    if (input.open) {
      setClosing(false);
    } else if (wasOpen && cause === "toggle" && !skipMotion) {
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
      reducedMotion: skipMotion,
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
    input.isSettingsRoute,
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

  // Fires on `open` alone, not `occupiesLayout` (which stays true through the
  // close animation for consumers like the explorer dock's own occupancy).
  // The content pane's corner padding transition (see WindowChromeSafeArea)
  // starts alongside the sidebar's own width close so both motions begin
  // simultaneously.
  const onOccupiesLayoutChange = input.onOccupiesLayoutChange;
  useLayoutEffect(() => {
    onOccupiesLayoutChange?.(input.open);
  }, [input.open, onOccupiesLayoutChange]);

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
  };
}
