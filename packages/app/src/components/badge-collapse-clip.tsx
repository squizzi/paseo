import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { applyCollapseClipResize } from "@/components/collapse-clip-motion";
import { isWeb } from "@/constants/platform";
import { useObservedSize } from "@/hooks/use-observed-size";
import {
  MOTION_ARRIVE_TIMING,
  MOTION_CLIP_AUTO,
  MOTION_CONTENT_DELAY_MS,
  MOTION_EXIT_TIMING,
  MOTION_MICRO_OFFSET_PX,
  resolveArriveFadeStyle,
  resolveGrowthClipFrameStyle,
} from "@/styles/motion";

export interface ExpandableBadgeCollapseClipProps {
  expanded: boolean;
  renderDetails?: () => ReactNode;
  detailWrapperRef?: React.RefObject<View | null>;
  detailWrapperStyle?: StyleProp<ViewStyle>;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onClosingChange?: (isClosing: boolean) => void;
  testID?: string;
}

export function ExpandableBadgeCollapseClip({
  expanded,
  renderDetails,
  detailWrapperRef,
  detailWrapperStyle,
  onHoverIn,
  onHoverOut,
  onClosingChange,
  testID,
}: ExpandableBadgeCollapseClipProps) {
  const reducedMotion = useReducedMotion() === true;
  const height = useSharedValue(expanded ? MOTION_CLIP_AUTO : 0);
  const contentProgress = useSharedValue(expanded ? 1 : 0);
  const contentHeightRef = useRef(0);
  const targetHeightRef = useRef(0);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [renderChildren, setRenderChildren] = useState(expanded);
  const [settledOpen, setSettledOpen] = useState(expanded);
  const settledOpenRef = useRef(expanded);
  settledOpenRef.current = settledOpen;
  const lastContentRef = useRef<ReactNode>(null);

  if (expanded && renderDetails) {
    lastContentRef.current = renderDetails();
  }

  const markSettledOpen = useCallback(() => {
    if (!expandedRef.current) {
      return;
    }
    // Keep pixel height until the inner view is committed in-flow.
    settledOpenRef.current = true;
    setSettledOpen(true);
  }, []);

  const unmountCollapsed = useCallback(() => {
    if (expandedRef.current) {
      return;
    }
    setRenderChildren(false);
    lastContentRef.current = null;
    onClosingChange?.(false);
  }, [onClosingChange]);

  const handleMeasuredHeight = useCallback(
    (nextHeight: number) => {
      if (nextHeight > 0) {
        contentHeightRef.current = nextHeight;
      }
      applyCollapseClipResize({
        expanded,
        settledOpen: settledOpenRef.current,
        nextSize: nextHeight,
        targetSizeRef: targetHeightRef,
        size: height,
        onSettled: markSettledOpen,
      });
    },
    [expanded, height, markSettledOpen],
  );

  const { setNodeRef, onLayout: onObservedLayout } = useObservedSize({
    enabled: renderChildren,
    axis: "height",
    onSize: handleMeasuredHeight,
  });

  useLayoutEffect(() => {
    if (!expanded || !settledOpen) {
      return;
    }
    height.value = MOTION_CLIP_AUTO;
  }, [expanded, height, settledOpen]);

  useLayoutEffect(() => {
    if (reducedMotion) {
      cancelAnimation(height);
      cancelAnimation(contentProgress);
      height.value = expanded ? MOTION_CLIP_AUTO : 0;
      contentProgress.value = expanded ? 1 : 0;
      targetHeightRef.current = 0;
      settledOpenRef.current = expanded;
      setSettledOpen(expanded);
      setRenderChildren(expanded);
      onClosingChange?.(false);
      if (!expanded) {
        lastContentRef.current = null;
      }
      return;
    }

    if (expanded) {
      onClosingChange?.(false);
      setRenderChildren(true);
      if (settledOpenRef.current) {
        return;
      }
      cancelAnimation(height);
      targetHeightRef.current = height.value > 0 ? height.value : 0;
      cancelAnimation(contentProgress);
      contentProgress.value = 0;
      contentProgress.value = withDelay(
        MOTION_CONTENT_DELAY_MS,
        withTiming(1, MOTION_ARRIVE_TIMING),
      );
      return;
    }

    settledOpenRef.current = false;
    setSettledOpen(false);
    let from = 0;
    if (typeof height.value === "number" && height.value >= 0) {
      from = height.value;
    } else if (contentHeightRef.current > 0) {
      from = contentHeightRef.current;
    }
    targetHeightRef.current = 0;
    cancelAnimation(contentProgress);
    contentProgress.value = withTiming(0, MOTION_EXIT_TIMING);
    if (from <= 0) {
      cancelAnimation(height);
      height.value = 0;
      setRenderChildren(false);
      lastContentRef.current = null;
      onClosingChange?.(false);
      return;
    }

    onClosingChange?.(true);
    cancelAnimation(height);
    height.value = from;
    height.value = withTiming(0, MOTION_EXIT_TIMING, (finished) => {
      if (finished) {
        runOnJS(unmountCollapsed)();
      }
    });
  }, [contentProgress, expanded, height, onClosingChange, reducedMotion, unmountCollapsed]);

  const clipStyle = useAnimatedStyle(() => resolveGrowthClipFrameStyle(height.value, "height"));
  const contentStyle = useAnimatedStyle(() =>
    resolveArriveFadeStyle(contentProgress.value, MOTION_MICRO_OFFSET_PX),
  );

  if (!renderChildren && !expanded) {
    return null;
  }

  const content = lastContentRef.current;
  if (!content) {
    return null;
  }

  return (
    <Animated.View
      ref={detailWrapperRef}
      style={[styles.clipFrame, detailWrapperStyle, clipStyle]}
      testID={testID}
      onPointerEnter={isWeb ? onHoverIn : undefined}
      onPointerLeave={isWeb ? onHoverOut : undefined}
    >
      <Animated.View
        ref={setNodeRef}
        collapsable={false}
        onLayout={onObservedLayout}
        style={[settledOpen ? undefined : styles.clipInner, contentStyle]}
      >
        {content}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clipFrame: {
    position: "relative",
    width: "100%",
  },
  clipInner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
});
