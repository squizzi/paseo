import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { StreamWordFade } from "@/agent-stream/stream-word-fade";
import { applyGrowthSize } from "@/components/collapse-clip-motion";
import { useObservedSize } from "@/hooks/use-observed-size";
import { MOTION_CLIP_AUTO, resolveGrowthClipFrameStyle } from "@/styles/motion";
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
  const width = useSharedValue(MOTION_CLIP_AUTO);

  const applyMeasuredWidth = useCallback(
    (nextWidth: number) => {
      applyGrowthSize(width, contentWidthRef, nextWidth);
    },
    [width],
  );

  const { setNodeRef, onLayout: onObservedLayout } = useObservedSize({
    enabled: true,
    axis: "width",
    onSize: applyMeasuredWidth,
    revision: text,
  });

  const clipStyle = useAnimatedStyle(() => resolveGrowthClipFrameStyle(width.value, "width"));

  const incoming: ReactNode =
    fadeIncoming && parts.incoming.length > 0 ? (
      <StreamWordFade text={parts.incoming} enabled />
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
