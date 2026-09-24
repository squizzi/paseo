import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { CHAT_ENTRY_EASING } from "@/agent-stream/chat-entry-motion";
import {
  BADGE_COLLAPSE_AUTO_HEIGHT,
  BADGE_COLLAPSE_DURATION_MS,
  type BadgeCollapseClipFrameStyle,
  type BadgeCollapseClipResize,
  resolveBadgeCollapseClipFrameStyle,
  resolveBadgeCollapseClipResize,
} from "@/components/badge-collapse-motion";
import { isWeb } from "@/constants/platform";

export {
  BADGE_COLLAPSE_AUTO_HEIGHT,
  BADGE_COLLAPSE_DURATION_MS,
  type BadgeCollapseClipFrameStyle,
  type BadgeCollapseClipResize,
  resolveBadgeCollapseClipFrameStyle,
  resolveBadgeCollapseClipResize,
};

export const BADGE_COLLAPSE_EASING = CHAT_ENTRY_EASING;

export const BADGE_COLLAPSE_TIMING = {
  duration: BADGE_COLLAPSE_DURATION_MS,
  easing: BADGE_COLLAPSE_EASING,
  reduceMotion: ReduceMotion.System,
};

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
  const height = useSharedValue(expanded ? BADGE_COLLAPSE_AUTO_HEIGHT : 0);
  const contentHeightRef = useRef(0);
  const targetHeightRef = useRef(0);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [renderChildren, setRenderChildren] = useState(expanded);
  const [settledOpen, setSettledOpen] = useState(expanded);
  const settledOpenRef = useRef(expanded);
  settledOpenRef.current = settledOpen;
  const innerElementRef = useRef<HTMLElement | null>(null);
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
      const decision = resolveBadgeCollapseClipResize({
        expanded,
        settledOpen: settledOpenRef.current,
        nextHeight,
        targetHeight: targetHeightRef.current,
      });
      if (decision.action === "ignore") {
        return;
      }
      targetHeightRef.current = decision.to;
      cancelAnimation(height);
      if (height.value < 0) {
        height.value = 0;
      }
      height.value = withTiming(decision.to, BADGE_COLLAPSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(markSettledOpen)();
        }
      });
    },
    [expanded, height, markSettledOpen],
  );

  const setInnerRef = useCallback((node: unknown) => {
    innerElementRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);

  const handleInnerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isWeb) {
        handleMeasuredHeight(event.nativeEvent.layout.height);
      }
    },
    [handleMeasuredHeight],
  );

  useLayoutEffect(() => {
    if (!renderChildren || !isWeb || typeof ResizeObserver !== "function") {
      return;
    }
    const node = innerElementRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        handleMeasuredHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    handleMeasuredHeight(node.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [handleMeasuredHeight, renderChildren]);

  useLayoutEffect(() => {
    if (!expanded || !settledOpen) {
      return;
    }
    height.value = BADGE_COLLAPSE_AUTO_HEIGHT;
  }, [expanded, height, settledOpen]);

  useLayoutEffect(() => {
    if (reducedMotion) {
      cancelAnimation(height);
      height.value = expanded ? BADGE_COLLAPSE_AUTO_HEIGHT : 0;
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
    height.value = withTiming(0, BADGE_COLLAPSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(unmountCollapsed)();
      }
    });
  }, [expanded, height, onClosingChange, reducedMotion, unmountCollapsed]);

  const clipStyle = useAnimatedStyle(() => resolveBadgeCollapseClipFrameStyle(height.value));

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
      <View
        ref={setInnerRef}
        collapsable={false}
        onLayout={handleInnerLayout}
        style={settledOpen ? undefined : styles.clipInner}
      >
        {content}
      </View>
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
