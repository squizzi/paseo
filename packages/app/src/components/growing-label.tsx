import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { StreamWordFade } from "@/agent-stream/stream-word-fade";
import { isWeb } from "@/constants/platform";
import { MOTION_ARRIVE_TIMING } from "@/styles/motion";
import { splitGrowingLabel } from "./growing-label-parts";

interface GrowingLabelProps {
  text: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  fadeIncoming?: boolean;
}

export function GrowingLabel({
  text,
  style,
  numberOfLines,
  onLayout,
  fadeIncoming = true,
}: GrowingLabelProps) {
  const previousTextRef = useRef("");
  const parts = splitGrowingLabel(previousTextRef.current, text);
  useLayoutEffect(() => {
    previousTextRef.current = text;
  }, [text]);
  const contentWidthRef = useRef<number | null>(null);
  const innerElementRef = useRef<HTMLElement | null>(null);
  const width = useSharedValue(-1);

  const applyMeasuredWidth = useCallback(
    (nextWidth: number) => {
      if (nextWidth <= 0) {
        return;
      }
      const previousWidth = contentWidthRef.current;
      if (previousWidth !== null && Math.abs(nextWidth - previousWidth) <= 0.5) {
        return;
      }
      contentWidthRef.current = nextWidth;
      if (previousWidth === null) {
        cancelAnimation(width);
        width.value = nextWidth;
        return;
      }
      if (nextWidth <= previousWidth + 0.5) {
        cancelAnimation(width);
        width.value = nextWidth;
        return;
      }
      cancelAnimation(width);
      width.value = withTiming(nextWidth, MOTION_ARRIVE_TIMING);
    },
    [width],
  );

  const setInnerRef = useCallback((node: unknown) => {
    innerElementRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);

  const handleInnerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isWeb) {
        applyMeasuredWidth(event.nativeEvent.layout.width);
      }
    },
    [applyMeasuredWidth],
  );

  useLayoutEffect(() => {
    if (!isWeb || typeof ResizeObserver !== "function") {
      return;
    }
    const node = innerElementRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        applyMeasuredWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    applyMeasuredWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [applyMeasuredWidth, text]);

  const clipStyle = useAnimatedStyle(() => {
    if (width.value < 0) {
      return { overflow: "hidden" as const };
    }
    return {
      width: width.value,
      overflow: "hidden" as const,
    };
  });

  const incoming: ReactNode =
    fadeIncoming && parts.incoming.length > 0 ? (
      <StreamWordFade text={parts.incoming} enabled />
    ) : (
      parts.incoming
    );

  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      <View ref={setInnerRef} collapsable={false} onLayout={handleInnerLayout} style={styles.inner}>
        <Text style={style} numberOfLines={numberOfLines} onLayout={onLayout}>
          {parts.prefix}
          {incoming}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
  },
  inner: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
});
