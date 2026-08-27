import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { MOTION_ARRIVE_TIMING, MOTION_CLIP_AUTO, MOTION_EXIT_TIMING } from "@/styles/motion";
import { isWeb } from "@/constants/platform";
import {
  forgetTabMotionId,
  isNewTabMotionItem,
  rememberTabMotionId,
  resolveTabMotionExitFromWidth,
  resolveTabMotionFrameStyle,
  resolveTabMotionInitialWidth,
  seedTabMotionIds,
  shouldFollowTabMotionTargetWidth,
} from "./workspace-tab-motion-helpers";

interface TabMotionRegistry {
  didHydrate: { current: boolean };
  seenIds: { current: Set<string> };
}

const TabMotionContext = createContext<TabMotionRegistry | null>(null);
const EMPTY_TAB_MOTION_SET: ReadonlySet<string> = new Set();

export function WorkspaceTabMotionProvider({
  tabIds,
  ready = true,
  children,
}: {
  tabIds: readonly string[];
  ready?: boolean;
  children: ReactNode;
}) {
  const didHydrate = useRef(false);
  const seenIds = useRef(new Set<string>());
  const registry = useMemo(() => ({ didHydrate, seenIds }), []);

  seedTabMotionIds({
    seenIds: seenIds.current,
    didHydrate: didHydrate.current,
    ids: tabIds,
  });

  useEffect(() => {
    if (!ready || didHydrate.current) {
      return;
    }
    seedTabMotionIds({
      seenIds: seenIds.current,
      didHydrate: false,
      ids: tabIds,
    });
    didHydrate.current = true;
  }, [ready, tabIds]);

  return <TabMotionContext.Provider value={registry}>{children}</TabMotionContext.Provider>;
}

export function useIsNewTab(id: string): boolean {
  const registry = useContext(TabMotionContext);
  const isNew = isNewTabMotionItem({
    id,
    didHydrate: registry?.didHydrate.current === true,
    seenIds: registry?.seenIds.current ?? EMPTY_TAB_MOTION_SET,
  });

  useEffect(() => {
    rememberTabMotionId(id);
    if (!registry) return;
    registry.seenIds.current.add(id);
  }, [id, registry]);

  return isNew;
}

export function WorkspaceTabMotionView({
  tabId,
  targetWidth: initialTargetWidth,
  entering,
  exiting,
  marginHorizontal = 2,
  style,
  children,
}: {
  tabId?: string;
  targetWidth?: number;
  entering: boolean;
  exiting: boolean;
  marginHorizontal?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion() === true;
  const hasExplicitTarget = Boolean(initialTargetWidth && initialTargetWidth > 0);
  const didArmEnter = useRef(false);
  const didArmExit = useRef(false);
  const lastAppliedWidth = useRef(entering && !reducedMotion ? 0 : (initialTargetWidth ?? 0));
  const measuredWidth = useRef(initialTargetWidth ?? 0);

  const initialWidth = resolveTabMotionInitialWidth({
    entering,
    reducedMotion,
    targetWidth: initialTargetWidth,
  });
  const initialOpacity = entering && !reducedMotion ? 0 : 1;
  const initialAnimating = (entering || exiting) && !reducedMotion;

  const width = useSharedValue(initialWidth);
  const opacity = useSharedValue(initialOpacity);
  const isAnimating = useSharedValue(initialAnimating);
  const targetWidthVal = useSharedValue(
    initialTargetWidth && initialTargetWidth > 0 ? initialTargetWidth : measuredWidth.current,
  );

  useEffect(() => {
    if (!initialTargetWidth || initialTargetWidth <= 0) {
      return;
    }
    measuredWidth.current = initialTargetWidth;
    targetWidthVal.value = initialTargetWidth;
    if (
      !shouldFollowTabMotionTargetWidth({
        nextWidth: initialTargetWidth,
        lastAppliedWidth: lastAppliedWidth.current,
        entering,
        didArmEnter: didArmEnter.current,
        exiting,
      })
    ) {
      return;
    }
    lastAppliedWidth.current = initialTargetWidth;
    if (reducedMotion) {
      cancelAnimation(width);
      width.value = initialTargetWidth;
      opacity.value = 1;
      isAnimating.value = false;
      return;
    }
    isAnimating.value = true;
    cancelAnimation(width);
    width.value = withTiming(initialTargetWidth, MOTION_ARRIVE_TIMING, (finished) => {
      if (finished) {
        isAnimating.value = false;
      }
    });
  }, [
    entering,
    exiting,
    initialTargetWidth,
    isAnimating,
    opacity,
    reducedMotion,
    targetWidthVal,
    width,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = event.nativeEvent.layout.width;
      if (nextWidth <= 0) return;
      if (!initialTargetWidth || initialTargetWidth <= 0) {
        measuredWidth.current = nextWidth;
        targetWidthVal.value = nextWidth;
        if (entering && !didArmEnter.current) {
          didArmEnter.current = true;
          lastAppliedWidth.current = nextWidth;
          if (reducedMotion) {
            width.value = nextWidth;
            opacity.value = 1;
            isAnimating.value = false;
            return;
          }
          isAnimating.value = true;
          width.value = 0;
          opacity.value = 0;
          width.value = withTiming(nextWidth, MOTION_ARRIVE_TIMING, (finished) => {
            if (finished) {
              isAnimating.value = false;
              width.value = MOTION_CLIP_AUTO;
            }
          });
          opacity.value = withTiming(1, MOTION_ARRIVE_TIMING);
        }
      }
    },
    [entering, initialTargetWidth, isAnimating, opacity, reducedMotion, targetWidthVal, width],
  );

  useLayoutEffect(() => {
    if (entering && !didArmEnter.current && initialTargetWidth && initialTargetWidth > 0) {
      didArmEnter.current = true;
      lastAppliedWidth.current = initialTargetWidth;
      if (reducedMotion) {
        width.value = initialTargetWidth;
        opacity.value = 1;
        isAnimating.value = false;
        return;
      }
      isAnimating.value = true;
      width.value = 0;
      opacity.value = 0;
      width.value = withTiming(initialTargetWidth, MOTION_ARRIVE_TIMING, (finished) => {
        if (finished) {
          isAnimating.value = false;
        }
      });
      opacity.value = withTiming(1, MOTION_ARRIVE_TIMING);
    }
  }, [entering, initialTargetWidth, isAnimating, opacity, reducedMotion, width]);

  useLayoutEffect(() => {
    if (exiting && !didArmExit.current) {
      didArmExit.current = true;
      if (tabId) {
        forgetTabMotionId(tabId);
      }
      if (reducedMotion) {
        width.value = 0;
        opacity.value = 0;
        isAnimating.value = false;
        return;
      }
      const from = resolveTabMotionExitFromWidth(width.value, measuredWidth.current);
      isAnimating.value = true;
      width.value = from;
      width.value = withTiming(0, MOTION_EXIT_TIMING, (finished) => {
        if (finished) {
          isAnimating.value = false;
        }
      });
      opacity.value = withTiming(0, MOTION_EXIT_TIMING);
    }
  }, [exiting, isAnimating, opacity, reducedMotion, tabId, width]);

  const animatedStyle = useAnimatedStyle(() =>
    resolveTabMotionFrameStyle({
      width: width.value,
      targetWidth: targetWidthVal.value,
      opacity: opacity.value,
      marginHorizontal,
      isAnimating: isAnimating.value,
    }),
  );

  const chip = hasExplicitTarget ? (
    children
  ) : (
    <View collapsable={false} onLayout={handleLayout} style={styles.intrinsicWidth}>
      {children}
    </View>
  );

  return (
    <Animated.View
      style={[style, animatedStyle]}
      onLayout={hasExplicitTarget ? handleLayout : undefined}
    >
      {chip}
    </Animated.View>
  );
}

const styles = StyleSheet.create((_theme) => ({
  intrinsicWidth: {
    alignSelf: "flex-start",
    ...(isWeb
      ? {
          minWidth: "max-content" as unknown as ViewStyle["minWidth"],
          width: "max-content" as unknown as ViewStyle["width"],
        }
      : {}),
  },
}));
