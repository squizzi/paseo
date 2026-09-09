import { useCallback, useLayoutEffect, useRef } from "react";
import type { NativeScrollEvent, ScrollView } from "react-native";

// Nested streaming panels use the same follow-output contract as the chat viewport:
// stick to the latest output, detach if the reader scrolls up, reattach at the bottom.
// When streaming ends, keep the current offset instead of letting a relayout jump to the start.

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

export function shouldIgnoreFollowOutputScrollReset(input: {
  restoreOffsetY: number | null;
  offsetY: number;
}): boolean {
  return (
    input.restoreOffsetY !== null &&
    input.restoreOffsetY > 0 &&
    input.offsetY <= RESUME_THRESHOLD_PX
  );
}

export function resolveFollowOutputContentSizeAction(input: {
  enabled: boolean;
  following: boolean;
  restoreOffsetY: number | null;
}): "stick-end" | "restore" | "none" {
  if (shouldStickFollowOutputToBottom(input)) {
    return "stick-end";
  }
  if (!input.enabled && input.restoreOffsetY !== null) {
    return "restore";
  }
  return "none";
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
  const restoreOffsetYRef = useRef<number | null>(null);
  if (!enabled && enabledRef.current) {
    restoreOffsetYRef.current = stateRef.current.offsetY;
  }
  if (enabled && !enabledRef.current) {
    stateRef.current = createFollowOutputScrollState(stateRef.current.offsetY);
    restoreOffsetYRef.current = null;
  }
  enabledRef.current = enabled;

  const applyContentSizeAction = useCallback(() => {
    const action = resolveFollowOutputContentSizeAction({
      enabled: enabledRef.current,
      following: stateRef.current.following,
      restoreOffsetY: restoreOffsetYRef.current,
    });
    if (action === "stick-end") {
      scrollRef.current?.scrollToEnd({ animated: false });
      return;
    }
    if (action === "restore") {
      const offsetY = restoreOffsetYRef.current;
      if (offsetY === null) {
        return;
      }
      scrollRef.current?.scrollTo({ y: offsetY, animated: false });
    }
  }, []);

  const onContentSizeChange = useCallback(() => {
    applyContentSizeAction();
  }, [applyContentSizeAction]);

  const onScroll = useCallback(
    (event: {
      nativeEvent: Pick<NativeScrollEvent, "contentOffset" | "contentSize" | "layoutMeasurement">;
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (
        shouldIgnoreFollowOutputScrollReset({
          restoreOffsetY: restoreOffsetYRef.current,
          offsetY: contentOffset.y,
        })
      ) {
        applyContentSizeAction();
        return;
      }
      restoreOffsetYRef.current = null;
      stateRef.current = reduceFollowOutputUserScroll(stateRef.current, {
        offsetY: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      });
    },
    [applyContentSizeAction],
  );

  useLayoutEffect(() => {
    applyContentSizeAction();
  }, [applyContentSizeAction, enabled]);

  return { scrollRef, onContentSizeChange, onScroll };
}
