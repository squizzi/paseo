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
import { MOTION_CLIP_AUTO, MOTION_EXIT_TIMING } from "@/styles/motion";
import { applyCollapseClipResize } from "@/components/collapse-clip-motion";
import {
  EXPAND_WIDTH_FILL,
  resolveExpandWidthFrameStyle,
  shouldStretchExpandWidthTrack,
} from "@/components/expand-width-motion";
import { useObservedSize } from "@/hooks/use-observed-size";

export { EXPAND_WIDTH_FILL, resolveExpandWidthFrameStyle, shouldStretchExpandWidthTrack };

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
  const width = useSharedValue(expanded ? EXPAND_WIDTH_FILL : MOTION_CLIP_AUTO);
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
    width.value = MOTION_CLIP_AUTO;
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
      applyCollapseClipResize({
        expanded,
        settledOpen: settledOpenRef.current,
        nextSize: nextWidth,
        targetSizeRef: targetWidthRef,
        size: width,
        fromSentinel: collapsedWidthRef.current,
        onSettled: markSettledOpen,
      });
    },
    [expanded, markSettledOpen, stretchTrack, width],
  );

  const { setNodeRef: setTrackRef, onLayout: handleTrackLayout } = useObservedSize({
    enabled: true,
    axis: "width",
    onSize: handleTrackWidth,
  });

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
    if (reducedMotion) {
      cancelAnimation(width);
      width.value = expanded ? EXPAND_WIDTH_FILL : MOTION_CLIP_AUTO;
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
      width.value = MOTION_CLIP_AUTO;
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
