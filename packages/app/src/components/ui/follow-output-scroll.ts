import { useCallback, useRef } from "react";
import type { NativeScrollEvent, ScrollView } from "react-native";

// Nested streaming panels use the same follow-output contract as the chat viewport:
// stick to the latest output, detach if the reader scrolls up, reattach at the bottom.

export interface FollowOutputScrollState {
  following: boolean;
  offsetY: number;
}

export interface FollowOutputScrollMetrics {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
}

const USER_SCROLL_DELTA_EPSILON = 1;
const RESUME_THRESHOLD_PX = 1;

export function createFollowOutputScrollState(offsetY = 0): FollowOutputScrollState {
  return { following: true, offsetY };
}

export function isFollowOutputAtBottom(metrics: FollowOutputScrollMetrics): boolean {
  const { offsetY, contentHeight, viewportHeight } = metrics;
  if (![offsetY, contentHeight, viewportHeight].every(Number.isFinite)) {
    return true;
  }
  return contentHeight - viewportHeight - offsetY <= RESUME_THRESHOLD_PX;
}

export function shouldStickFollowOutputToBottom(input: {
  enabled: boolean;
  following: boolean;
}): boolean {
  return input.enabled && input.following;
}

export function reduceFollowOutputUserScroll(
  state: FollowOutputScrollState,
  metrics: FollowOutputScrollMetrics,
): FollowOutputScrollState {
  const scrolledUp = metrics.offsetY < state.offsetY - USER_SCROLL_DELTA_EPSILON;
  const scrolledDown = metrics.offsetY > state.offsetY + USER_SCROLL_DELTA_EPSILON;
  const atBottom = isFollowOutputAtBottom(metrics);

  if (!state.following && atBottom && scrolledDown) {
    return { following: true, offsetY: metrics.offsetY };
  }
  if (state.following && scrolledUp) {
    return { following: false, offsetY: metrics.offsetY };
  }
  return { following: state.following, offsetY: metrics.offsetY };
}

export function useFollowOutputScroll(enabled: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const stateRef = useRef(createFollowOutputScrollState());
  const enabledRef = useRef(enabled);
  if (enabled && !enabledRef.current) {
    stateRef.current = createFollowOutputScrollState(stateRef.current.offsetY);
  }
  enabledRef.current = enabled;

  const onContentSizeChange = useCallback(() => {
    if (
      !shouldStickFollowOutputToBottom({
        enabled: enabledRef.current,
        following: stateRef.current.following,
      })
    ) {
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const onScroll = useCallback(
    (event: {
      nativeEvent: Pick<NativeScrollEvent, "contentOffset" | "contentSize" | "layoutMeasurement">;
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      stateRef.current = reduceFollowOutputUserScroll(stateRef.current, {
        offsetY: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      });
    },
    [],
  );

  return { scrollRef, onContentSizeChange, onScroll };
}
