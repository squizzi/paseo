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
import { resolveCollapseClipResize } from "@/components/collapse-clip-motion";
import {
  resolveSidebarCollapseClipFrameStyle,
  SIDEBAR_ITEM_MOTION_AUTO_HEIGHT,
} from "@/components/sidebar/item-motion";
import { MOTION_ARRIVE_TIMING, MOTION_EXIT_TIMING } from "@/styles/motion";

export function SidebarCollapseClip({
  expanded,
  children,
  innerStyle,
  testID,
}: {
  expanded: boolean;
  children: ReactNode;
  innerStyle?: StyleProp<ViewStyle>;
  testID: string;
}) {
  const reducedMotion = useReducedMotion() === true;
  const height = useSharedValue(expanded ? SIDEBAR_ITEM_MOTION_AUTO_HEIGHT : 0);
  const contentHeightRef = useRef(0);
  const targetHeightRef = useRef(0);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [renderChildren, setRenderChildren] = useState(expanded);
  const [settledOpen, setSettledOpen] = useState(expanded);
  const settledOpenRef = useRef(expanded);
  settledOpenRef.current = settledOpen;

  const markSettledOpen = useCallback(() => {
    if (!expandedRef.current) {
      return;
    }
    // Keep the pixel height until the inner is in flow. Releasing auto while it
    // is still absolutely positioned collapses the clip to 0 for a frame.
    settledOpenRef.current = true;
    setSettledOpen(true);
  }, []);

  const unmountCollapsed = useCallback(() => {
    if (expandedRef.current) {
      return;
    }
    setRenderChildren(false);
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      if (nextHeight > 0) {
        contentHeightRef.current = nextHeight;
      }
      const decision = resolveCollapseClipResize({
        expanded,
        settledOpen: settledOpenRef.current,
        nextSize: nextHeight,
        targetSize: targetHeightRef.current,
      });
      if (decision.action === "ignore") {
        return;
      }
      targetHeightRef.current = decision.to;
      height.value = withTiming(decision.to, MOTION_ARRIVE_TIMING, (finished) => {
        if (finished) {
          runOnJS(markSettledOpen)();
        }
      });
    },
    [expanded, height, markSettledOpen],
  );

  useLayoutEffect(() => {
    if (!expanded || !settledOpen) {
      return;
    }
    height.value = SIDEBAR_ITEM_MOTION_AUTO_HEIGHT;
  }, [expanded, height, settledOpen]);

  useLayoutEffect(() => {
    if (reducedMotion) {
      cancelAnimation(height);
      height.value = expanded ? SIDEBAR_ITEM_MOTION_AUTO_HEIGHT : 0;
      targetHeightRef.current = 0;
      settledOpenRef.current = expanded;
      setSettledOpen(expanded);
      setRenderChildren(expanded);
      return;
    }

    if (expanded) {
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
    const from = height.value < 0 ? contentHeightRef.current : height.value;
    targetHeightRef.current = 0;
    if (from <= 0) {
      cancelAnimation(height);
      height.value = 0;
      setRenderChildren(false);
      return;
    }
    cancelAnimation(height);
    height.value = from;
    height.value = withTiming(0, MOTION_EXIT_TIMING, (finished) => {
      if (finished) {
        runOnJS(unmountCollapsed)();
      }
    });
  }, [expanded, height, reducedMotion, unmountCollapsed]);

  const clipStyle = useAnimatedStyle(() => resolveSidebarCollapseClipFrameStyle(height.value));

  return (
    <Animated.View style={[styles.clipFrame, clipStyle]} testID={testID}>
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={[innerStyle, settledOpen ? undefined : styles.clipInner]}
      >
        {renderChildren ? children : null}
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
