import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { isWeb } from "@/constants/platform";
import { MOTION_ARRIVE_TIMING, MOTION_EXIT_TIMING } from "@/styles/motion";
import { resolveCollapseClipResize } from "@/components/collapse-clip-motion";
import {
  EXPAND_WIDTH_AUTO,
  EXPAND_WIDTH_FILL,
  resolveExpandWidthFrameStyle,
  shouldStretchExpandWidthTrack,
} from "@/components/expand-width-motion";

export {
  EXPAND_WIDTH_AUTO,
  EXPAND_WIDTH_FILL,
  resolveExpandWidthFrameStyle,
  shouldStretchExpandWidthTrack,
};

export function ExpandWidthClip({
  expanded,
  children,
  style,
  onClosingChange,
  testID,
}: {
  expanded: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onClosingChange?: (isClosing: boolean) => void;
  testID?: string;
}) {
  const reducedMotion = useReducedMotion() === true;
  const width = useSharedValue(expanded ? EXPAND_WIDTH_FILL : EXPAND_WIDTH_AUTO);
  const collapsedWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const targetWidthRef = useRef(0);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [sizeLocked, setSizeLocked] = useState(expanded);
  const [settledOpen, setSettledOpen] = useState(expanded);
  const settledOpenRef = useRef(expanded);
  settledOpenRef.current = settledOpen;
  const [closing, setClosing] = useState(false);
  const trackElementRef = useRef<HTMLElement | null>(null);

  const stretchTrack = shouldStretchExpandWidthTrack({
    expanded,
    sizeLocked,
    closing,
  });

  const markSettledOpen = useCallback(() => {
    if (!expandedRef.current) {
      return;
    }
    settledOpenRef.current = true;
    setSettledOpen(true);
    width.value = EXPAND_WIDTH_FILL;
  }, [width]);

  const finishClose = useCallback(() => {
    if (expandedRef.current) {
      return;
    }
    setClosing(false);
    setSizeLocked(false);
    width.value = EXPAND_WIDTH_AUTO;
    onClosingChange?.(false);
  }, [onClosingChange, width]);

  const handleTrackWidth = useCallback(
    (nextWidth: number) => {
      if (!stretchTrack) {
        if (nextWidth > 0) {
          collapsedWidthRef.current = nextWidth;
          contentWidthRef.current = nextWidth;
        }
        return;
      }
      const decision = resolveCollapseClipResize({
        expanded,
        settledOpen: settledOpenRef.current,
        nextSize: nextWidth,
        targetSize: targetWidthRef.current,
      });
      if (decision.action === "ignore") {
        return;
      }
      targetWidthRef.current = decision.to;
      cancelAnimation(width);
      if (width.value < 0) {
        const from = collapsedWidthRef.current;
        width.value = from > 0 ? from : 0;
      }
      width.value = withTiming(decision.to, MOTION_ARRIVE_TIMING, (finished) => {
        if (finished) {
          runOnJS(markSettledOpen)();
        }
      });
    },
    [expanded, markSettledOpen, stretchTrack, width],
  );

  const setTrackRef = useCallback((node: unknown) => {
    trackElementRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);

  const handleTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isWeb) {
        handleTrackWidth(event.nativeEvent.layout.width);
      }
    },
    [handleTrackWidth],
  );

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      contentWidthRef.current = nextWidth;
      if (!expandedRef.current && !settledOpenRef.current) {
        collapsedWidthRef.current = nextWidth;
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!stretchTrack || !isWeb || typeof ResizeObserver !== "function") {
      return;
    }
    const node = trackElementRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        handleTrackWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    handleTrackWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [handleTrackWidth, stretchTrack]);

  useLayoutEffect(() => {
    if (reducedMotion) {
      cancelAnimation(width);
      width.value = expanded ? EXPAND_WIDTH_FILL : EXPAND_WIDTH_AUTO;
      targetWidthRef.current = 0;
      settledOpenRef.current = expanded;
      setSettledOpen(expanded);
      setSizeLocked(expanded);
      setClosing(false);
      onClosingChange?.(false);
      return;
    }

    if (expanded) {
      onClosingChange?.(false);
      setClosing(false);
      if (settledOpenRef.current) {
        return;
      }
      if (!sizeLocked) {
        const from = collapsedWidthRef.current;
        if (from > 0) {
          cancelAnimation(width);
          width.value = from;
        }
        setSizeLocked(true);
        return;
      }
      cancelAnimation(width);
      targetWidthRef.current = width.value > 0 ? width.value : 0;
      return;
    }

    settledOpenRef.current = false;
    setSettledOpen(false);
    let from = 0;
    if (typeof width.value === "number" && width.value >= 0) {
      from = width.value;
    } else if (contentWidthRef.current > 0) {
      from = contentWidthRef.current;
    }
    const to = collapsedWidthRef.current;
    targetWidthRef.current = to;
    if (from <= 0 || to <= 0 || Math.abs(from - to) <= 0.5) {
      cancelAnimation(width);
      width.value = EXPAND_WIDTH_AUTO;
      setSizeLocked(false);
      setClosing(false);
      onClosingChange?.(false);
      return;
    }

    setClosing(true);
    onClosingChange?.(true);
    cancelAnimation(width);
    width.value = from;
    width.value = withTiming(to, MOTION_EXIT_TIMING, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
  }, [expanded, finishClose, onClosingChange, reducedMotion, sizeLocked, width]);

  const clipStyle = useAnimatedStyle(() => resolveExpandWidthFrameStyle(width.value));
  const trackStyle = stretchTrack ? styles.trackStretch : styles.trackHug;

  return (
    <View
      ref={setTrackRef}
      collapsable={false}
      onLayout={handleTrackLayout}
      style={[trackStyle, style]}
      testID={testID}
    >
      <Animated.View style={[styles.clip, clipStyle]}>
        <View collapsable={false} onLayout={handleContentLayout} style={styles.content}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackHug: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
  },
  trackStretch: {
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  clip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
  },
  content: {
    alignSelf: "stretch",
    maxWidth: "100%",
    minWidth: 0,
  },
});
