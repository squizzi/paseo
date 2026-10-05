import { useCallback, useLayoutEffect, useRef } from "react";
import type { NativeScrollEvent, ScrollView, View } from "react-native";
import { applyContentRiseTransform, createDomContentRise } from "@/agent-stream/content-rise";
import { isWeb } from "@/constants/platform";

// Nested streaming panels use the same follow-output contract as the chat viewport:
// stick to the latest output, detach if the reader scrolls up, reattach at the bottom.
// After the stream ends, keep pinning to the end until the reader has scrolled the panel.
// Thinking panels remount when they leave the live head for history, so the last follow
// state is persisted by key and restored on the new instance.
// Visual stick-then-ease is shared with chat, but only after the panel overflows at
// maxHeight — rising while the card is still growing looks like the text is stuck.
//
// The stateful orchestration lives in `createFollowOutputScrollController`, a plain object
// that takes an injected `FollowOutputScrollable` port. `useFollowOutputScroll` is a thin
// React wrapper around it, so tests exercise the controller directly with a fake scrollable
// instead of mounting a component tree.

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

// Long-lived tabs stream many nested panels; cap retained positions so closed
// conversations don't accumulate entries forever.
export const MAX_PERSISTED_FOLLOW_OUTPUT_PANELS = 50;

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
  // Re-insert so the key becomes most-recently-written for the eviction order below.
  persistedFollowOutputScroll.delete(persistKey);
  persistedFollowOutputScroll.set(persistKey, state);
  if (persistedFollowOutputScroll.size > MAX_PERSISTED_FOLLOW_OUTPUT_PANELS) {
    const oldestKey = persistedFollowOutputScroll.keys().next().value;
    if (oldestKey !== undefined) {
      persistedFollowOutputScroll.delete(oldestKey);
    }
  }
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
  hasStreamed?: boolean;
}): boolean {
  if (!input.following) {
    return false;
  }
  return input.enabled || Boolean(input.hasStreamed);
}

export function shouldIgnoreFollowOutputScrollReset(input: {
  following: boolean;
  offsetY: number;
  lastOffsetY: number;
  // True only for the first scroll report since the panel mounted, remounted, or its
  // content size last changed — the narrow window where native can echo a stale offset
  // of ~0 before the real layout settles. Outside that window, an offset near 0 is the
  // reader actually scrolling to the top.
  isLayoutReset: boolean;
}): boolean {
  if (input.offsetY > RESUME_THRESHOLD_PX) {
    return false;
  }
  if (input.following) {
    return true;
  }
  return input.isLayoutReset && input.lastOffsetY > RESUME_THRESHOLD_PX;
}

export function resolveFollowOutputContentSizeAction(input: {
  enabled: boolean;
  following: boolean;
  hasStreamed: boolean;
  restoreOffsetY: number | null;
}): "stick-end" | "restore" | "none" {
  if (shouldStickFollowOutputToBottom(input)) {
    return "stick-end";
  }
  if (input.restoreOffsetY !== null) {
    return "restore";
  }
  return "none";
}

const FOLLOW_OUTPUT_SIZE_EPSILON_PX = 1;

export interface FollowOutputPanelFrameStyle {
  flexGrow: 0;
  flexShrink: 0;
  maxHeight: number;
  height?: number;
}

/**
 * RN-web ScrollView is flexGrow 1 + overflow auto. In a max-content card that
 * becomes a scrollport at the first line instead of growing to the cap.
 * Size the frame with a definite height, like the composer.
 */
export function resolveFollowOutputPanelFrameStyle(input: {
  contentHeight: number;
  maxHeight: number;
}): FollowOutputPanelFrameStyle {
  const frame: FollowOutputPanelFrameStyle = {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: input.maxHeight,
  };
  if (input.contentHeight <= 0) {
    return frame;
  }
  return {
    ...frame,
    height: Math.min(input.contentHeight, input.maxHeight),
  };
}

export function shouldEnableFollowOutputPanelScroll(input: {
  contentHeight: number;
  maxHeight: number;
}): boolean {
  return input.contentHeight > 0 && input.contentHeight >= input.maxHeight;
}

/**
 * Nested panels grow into their cap first. Rising while the card is still
 * expanding translates new text out of the short viewport and looks stuck.
 * Rise only after the viewport is at the cap and the content overflows it.
 */
export function shouldApplyFollowOutputContentRise(input: {
  following: boolean;
  hasLaidOut: boolean;
  contentHeight: number;
  viewportHeight: number;
  maxHeight: number | undefined;
}): boolean {
  if (!input.following || !input.hasLaidOut) {
    return false;
  }
  if (input.maxHeight === undefined) {
    return false;
  }
  if (input.viewportHeight + FOLLOW_OUTPUT_SIZE_EPSILON_PX < input.maxHeight) {
    return false;
  }
  return input.contentHeight - input.viewportHeight > FOLLOW_OUTPUT_SIZE_EPSILON_PX;
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

export interface FollowOutputScrollable {
  scrollToEnd(options: { animated: boolean }): void;
  scrollTo(options: { y: number; animated: boolean }): void;
  applyContentRise?(distance: number): void;
}

export interface FollowOutputScrollController {
  attach(scrollable: FollowOutputScrollable | null): void;
  setPersistKey(persistKey: string | undefined): void;
  setEnabled(enabled: boolean): void;
  setMaxHeight(maxHeight: number | undefined): void;
  onContentSizeChange(contentHeight?: number): void;
  onScroll(metrics: FollowOutputScrollMetrics): void;
  mount(): void;
  unmount(): void;
}

export function createFollowOutputScrollController(
  initialEnabled: boolean,
  initialPersistKey?: string,
): FollowOutputScrollController {
  const persisted = readPersistedFollowOutputScroll(initialPersistKey);
  let scrollable: FollowOutputScrollable | null = null;
  let persistKey = initialPersistKey;
  let enabled = initialEnabled;
  let maxHeight: number | undefined;
  let state = persisted ?? createFollowOutputScrollState();
  let hasStreamed = initialEnabled || persisted !== null;
  let awaitingLayoutMeasure = true;
  let hasLaidOut = false;
  let lastContentHeight: number | null = null;
  let lastViewportHeight = 0;

  function applyContentSizeAction(): void {
    const following = state.following;
    const action = resolveFollowOutputContentSizeAction({
      enabled,
      following,
      hasStreamed,
      restoreOffsetY: following ? null : state.offsetY,
    });
    if (action === "stick-end") {
      scrollable?.scrollToEnd({ animated: false });
      return;
    }
    if (action === "restore") {
      scrollable?.scrollTo({ y: state.offsetY, animated: false });
    }
  }

  return {
    attach(next) {
      scrollable = next;
    },
    setPersistKey(next) {
      persistKey = next;
    },
    setEnabled(next) {
      if (next && !enabled) {
        state = createFollowOutputScrollState(state.offsetY);
      }
      enabled = next;
      if (enabled) {
        hasStreamed = true;
      }
    },
    setMaxHeight(next) {
      maxHeight = next;
    },
    onContentSizeChange(contentHeight) {
      awaitingLayoutMeasure = true;
      const hadLaidOut = hasLaidOut;
      hasLaidOut = true;
      applyContentSizeAction();
      // eslint-disable-next-line no-console
      console.log("[follow-debug] onContentSizeChange", {
        contentHeight,
        hadLaidOut,
        following: state.following,
        offsetY: state.offsetY,
        maxHeight,
      });
      if (contentHeight === undefined) {
        return;
      }
      const previousContentHeight = lastContentHeight;
      lastContentHeight = contentHeight;
      if (previousContentHeight === null || !hadLaidOut) {
        return;
      }
      const distance = contentHeight - previousContentHeight;
      if (distance <= 0.5) {
        return;
      }
      const shouldRise = shouldApplyFollowOutputContentRise({
        following: state.following,
        hasLaidOut: hadLaidOut,
        contentHeight,
        viewportHeight: lastViewportHeight,
        maxHeight,
      });
      // eslint-disable-next-line no-console
      console.log("[follow-debug] rise decision", {
        distance,
        shouldRise,
        viewportHeight: lastViewportHeight,
      });
      if (!shouldRise) {
        return;
      }
      scrollable?.applyContentRise?.(distance);
    },
    onScroll(metrics) {
      lastViewportHeight = metrics.viewportHeight;
      const isLayoutReset = awaitingLayoutMeasure;
      awaitingLayoutMeasure = false;
      const ignore = shouldIgnoreFollowOutputScrollReset({
        following: state.following,
        offsetY: metrics.offsetY,
        lastOffsetY: state.offsetY,
        isLayoutReset,
      });
      // eslint-disable-next-line no-console
      console.log("[follow-debug] onScroll", {
        metrics,
        isLayoutReset,
        ignore,
        followingBefore: state.following,
        offsetYBefore: state.offsetY,
      });
      if (ignore) {
        applyContentSizeAction();
        return;
      }
      state = reduceFollowOutputUserScroll(state, metrics);
      // eslint-disable-next-line no-console
      console.log("[follow-debug] state after reduce", {
        following: state.following,
        offsetY: state.offsetY,
      });
      if (hasStreamed) {
        writePersistedFollowOutputScroll(persistKey, state);
      }
    },
    mount() {
      const latestPersisted = readPersistedFollowOutputScroll(persistKey);
      if (latestPersisted) {
        state = latestPersisted;
        hasStreamed = true;
      }
      awaitingLayoutMeasure = true;
      applyContentSizeAction();
    },
    unmount() {
      if (hasStreamed) {
        writePersistedFollowOutputScroll(persistKey, state);
      }
    },
  };
}

function createWebContentRise(nodeRef: { current: unknown }) {
  return createDomContentRise((offset) => applyContentRiseTransform(nodeRef.current, offset));
}

export function useFollowOutputScroll(enabled: boolean, persistKey?: string, maxHeight?: number) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRiseRef = useRef<View>(null);
  const riseRef = useRef<ReturnType<typeof createDomContentRise> | null>(null);
  const controllerRef = useRef<FollowOutputScrollController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createFollowOutputScrollController(enabled, persistKey);
  }
  const controller = controllerRef.current;
  controller.setPersistKey(persistKey);
  controller.setEnabled(enabled);
  controller.setMaxHeight(maxHeight);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      controller.onContentSizeChange(height);
    },
    [controller],
  );

  const onScroll = useCallback(
    (event: {
      nativeEvent: Pick<NativeScrollEvent, "contentOffset" | "contentSize" | "layoutMeasurement">;
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      controller.onScroll({
        offsetY: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      });
    },
    [controller],
  );

  useLayoutEffect(() => {
    let rise = riseRef.current;
    if (isWeb && rise === null) {
      rise = createWebContentRise(contentRiseRef);
      riseRef.current = rise;
    }
    const contentRise = rise;
    controller.attach({
      scrollToEnd: (options) => scrollRef.current?.scrollToEnd(options),
      scrollTo: (options) => scrollRef.current?.scrollTo(options),
      applyContentRise: contentRise
        ? (distance) => {
            contentRise.start(distance);
          }
        : undefined,
    });
    controller.mount();
    return () => {
      contentRise?.cancel();
      controller.unmount();
    };
  }, [controller, enabled]);

  return { scrollRef, contentRiseRef, onContentSizeChange, onScroll };
}
