import { useCallback, useLayoutEffect, useRef } from "react";
import type { NativeScrollEvent, ScrollView } from "react-native";

// Nested streaming panels use the same follow-output contract as the chat viewport:
// stick to the latest output, detach if the reader scrolls up, reattach at the bottom.
// When streaming ends, keep the current offset instead of letting a relayout jump to the start.
// Thinking panels remount when they leave the live head for history, so the last follow
// state is persisted by key and restored on the new instance.

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

const persistedFollowOutputScroll = new Map<string, FollowOutputScrollState>();

export function resetFollowOutputScrollPersistence(): void {
  persistedFollowOutputScroll.clear();
}

export function createFollowOutputScrollState(offsetY = 0): FollowOutputScrollState {
  return { following: true, offsetY };
}

function readPersistedFollowOutputScroll(
  persistKey: string | undefined,
): FollowOutputScrollState | null {
  if (!persistKey) {
    return null;
  }
  return persistedFollowOutputScroll.get(persistKey) ?? null;
}

function writePersistedFollowOutputScroll(
  persistKey: string | undefined,
  state: FollowOutputScrollState,
): void {
  if (!persistKey) {
    return;
  }
  persistedFollowOutputScroll.set(persistKey, state);
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
  restoreToEnd: boolean;
  offsetY: number;
  following?: boolean;
  hasOverflow?: boolean;
}): boolean {
  const restoring =
    input.restoreToEnd ||
    (input.restoreOffsetY !== null && input.restoreOffsetY > 0) ||
    (Boolean(input.following) && Boolean(input.hasOverflow));
  return restoring && input.offsetY <= RESUME_THRESHOLD_PX;
}

export function resolveFollowOutputContentSizeAction(input: {
  enabled: boolean;
  following: boolean;
  restoreOffsetY: number | null;
  restoreToEnd: boolean;
}): "stick-end" | "restore" | "none" {
  if (shouldStickFollowOutputToBottom(input) || input.restoreToEnd) {
    return "stick-end";
  }
  if (input.restoreOffsetY !== null) {
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

export function useFollowOutputScroll(enabled: boolean, persistKey?: string) {
  const persisted = readPersistedFollowOutputScroll(persistKey);
  const scrollRef = useRef<ScrollView>(null);
  const stateRef = useRef(persisted ?? createFollowOutputScrollState());
  const enabledRef = useRef(enabled);
  const persistKeyRef = useRef(persistKey);
  persistKeyRef.current = persistKey;
  const restoreToEndRef = useRef(Boolean(persisted?.following) && !enabled);
  const restoreOffsetYRef = useRef<number | null>(
    persisted && !persisted.following ? persisted.offsetY : null,
  );
  if (!enabled && enabledRef.current) {
    if (stateRef.current.following) {
      restoreToEndRef.current = true;
      restoreOffsetYRef.current = null;
    } else {
      restoreToEndRef.current = false;
      restoreOffsetYRef.current = stateRef.current.offsetY;
    }
    writePersistedFollowOutputScroll(persistKey, stateRef.current);
  }
  if (enabled && !enabledRef.current) {
    stateRef.current = createFollowOutputScrollState(stateRef.current.offsetY);
    restoreToEndRef.current = false;
    restoreOffsetYRef.current = null;
  }
  enabledRef.current = enabled;

  const applyContentSizeAction = useCallback(() => {
    const action = resolveFollowOutputContentSizeAction({
      enabled: enabledRef.current,
      following: stateRef.current.following,
      restoreOffsetY: restoreOffsetYRef.current,
      restoreToEnd: restoreToEndRef.current,
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
      const hasOverflow = contentSize.height > layoutMeasurement.height + RESUME_THRESHOLD_PX;
      if (
        shouldIgnoreFollowOutputScrollReset({
          restoreOffsetY: restoreOffsetYRef.current,
          restoreToEnd: restoreToEndRef.current,
          offsetY: contentOffset.y,
          following: stateRef.current.following,
          hasOverflow,
        })
      ) {
        if (stateRef.current.following || restoreToEndRef.current) {
          scrollRef.current?.scrollToEnd({ animated: false });
        } else if (restoreOffsetYRef.current !== null || stateRef.current.offsetY > 0) {
          scrollRef.current?.scrollTo({
            y: restoreOffsetYRef.current ?? stateRef.current.offsetY,
            animated: false,
          });
        }
        return;
      }
      restoreToEndRef.current = false;
      restoreOffsetYRef.current = null;
      stateRef.current = reduceFollowOutputUserScroll(stateRef.current, {
        offsetY: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      });
      writePersistedFollowOutputScroll(persistKeyRef.current, stateRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const latestPersisted = readPersistedFollowOutputScroll(persistKeyRef.current);
    if (latestPersisted) {
      stateRef.current = latestPersisted;
      if (!enabledRef.current) {
        if (latestPersisted.following) {
          restoreToEndRef.current = true;
          restoreOffsetYRef.current = null;
        } else {
          restoreToEndRef.current = false;
          restoreOffsetYRef.current = latestPersisted.offsetY;
        }
      }
    }
    applyContentSizeAction();
    return () => {
      writePersistedFollowOutputScroll(persistKeyRef.current, stateRef.current);
    };
  }, [applyContentSizeAction, enabled]);

  return { scrollRef, onContentSizeChange, onScroll };
}
