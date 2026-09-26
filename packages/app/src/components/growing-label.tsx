import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { isWeb } from "@/constants/platform";
import { useObservedSize } from "@/hooks/use-observed-size";
import { useAnimationsEnabled } from "@/hooks/use-settings";
import {
  MOTION_ARRIVE_CSS,
  MOTION_ARRIVE_TIMING,
  MOTION_CLIP_AUTO,
  resolveGrowthClipFrameStyle,
} from "@/styles/motion";
import { MOTION_STREAM_WORD_FADE_DURATION_MS } from "@/styles/motion-tokens";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import { splitGrowingLabel } from "./growing-label-parts";

interface GrowingLabelProps {
  text: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  fadeIncoming?: boolean;
}

const GROWING_LABEL_CHUNK_TRANSITION = `opacity ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}`;

const growingLabelChunkHiddenStyle = inlineUnistylesStyle({
  opacity: 0,
  transition: GROWING_LABEL_CHUNK_TRANSITION,
});
const growingLabelChunkVisibleStyle = inlineUnistylesStyle({
  opacity: 1,
  transition: GROWING_LABEL_CHUNK_TRANSITION,
});

/**
 * Fades in a newly appended suffix while the parent container eases its width
 * to fit. Starts at opacity 0 and toggles to 1 on mount so the browser has two
 * committed frames to transition between.
 */
function GrowingLabelChunk({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);
  return (
    <Text style={visible ? growingLabelChunkVisibleStyle : growingLabelChunkHiddenStyle}>
      {text}
    </Text>
  );
}

/**
 * An animated label whose width smoothly expands and shrinks as summary
 * sentences change. The inner text sizes unconstrained so `numberOfLines={1}`
 * never prematurely truncates to "..." mid-animation, while the outer clip eases
 * width to dynamically shift in length without popping or showing blank gaps.
 */
export function GrowingLabel({
  text,
  style,
  numberOfLines,
  onLayout,
  fadeIncoming = true,
}: GrowingLabelProps) {
  const animationsEnabled = useAnimationsEnabled();
  const previousTextRef = useRef("");
  const parts = splitGrowingLabel(previousTextRef.current, text);

  useLayoutEffect(() => {
    previousTextRef.current = text;
  }, [text]);

  const contentWidthRef = useRef<number | null>(null);
  const width = useSharedValue(MOTION_CLIP_AUTO);

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
      if (previousWidth === null || !animationsEnabled) {
        cancelAnimation(width);
        width.value = nextWidth;
        return;
      }
      cancelAnimation(width);
      width.value = withTiming(nextWidth, MOTION_ARRIVE_TIMING);
    },
    [animationsEnabled, width],
  );

  const { setNodeRef, onLayout: onObservedLayout } = useObservedSize({
    enabled: true,
    axis: "width",
    onSize: applyMeasuredWidth,
    revision: text,
  });

  const clipStyle = useAnimatedStyle(() => resolveGrowthClipFrameStyle(width.value, "width"));

  const incoming: ReactNode =
    fadeIncoming && isWeb && parts.incoming.length > 0 ? (
      <GrowingLabelChunk
        key={`in-${previousTextRef.current.length}-${text.length}`}
        text={parts.incoming}
      />
    ) : (
      parts.incoming
    );

  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      <View ref={setNodeRef} collapsable={false} onLayout={onObservedLayout} style={styles.inner}>
        <Text style={style} numberOfLines={numberOfLines} onLayout={onLayout}>
          {parts.prefix}
          {incoming}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((_theme) => ({
  clip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  inner: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    ...(isWeb
      ? {
          minWidth: "max-content" as unknown as ViewStyle["minWidth"],
          width: "max-content" as unknown as ViewStyle["width"],
        }
      : {}),
  },
}));
