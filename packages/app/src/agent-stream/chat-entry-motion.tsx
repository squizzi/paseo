import React, { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { isWeb } from "@/constants/platform";
import type { StreamItem } from "@/types/stream";
import type { StreamLayoutItem } from "./layout";

export const CHAT_ENTRY_DURATION_MS = 160;
/** One easing curve for every chat arrival, growth, and spacing shift. */
export const CHAT_ENTRY_EASING = Easing.out(Easing.cubic);
const CHAT_ENTRY_OFFSET_PX = 6;

export function userMessageEntryKeys(
  item: Extract<StreamItem, { kind: "user_message" }>,
): string[] {
  const keys = [item.id];
  if (item.clientMessageId !== undefined) {
    keys.push(item.clientMessageId);
  }
  if (item.messageId !== undefined) {
    keys.push(item.messageId);
  }
  return keys;
}

export function shouldAnimateStreamItemEntry(
  layoutItem: StreamLayoutItem,
  pendingClientMessageIds: ReadonlySet<string>,
  hydratedUserMessageKeys: ReadonlySet<string> | null,
): boolean {
  // Assistant text owns motion per markdown block. Animating the row as well
  // double-fades the first paragraph and still leaves later blocks popping in.
  if (layoutItem.item.kind === "assistant_message") {
    return false;
  }
  // Submitted user rows must keep entry motion after a fast ack. Pending-only
  // animation dies when the provider echoes the message before 160ms.
  if (layoutItem.item.kind === "user_message") {
    const item = layoutItem.item;
    const isPendingSubmission =
      item.clientMessageId !== undefined && pendingClientMessageIds.has(item.clientMessageId);
    if (isPendingSubmission) {
      return true;
    }
    if (hydratedUserMessageKeys === null) {
      return false;
    }
    const isHydratedUserMessage = userMessageEntryKeys(item).some((key) =>
      hydratedUserMessageKeys.has(key),
    );
    return !isHydratedUserMessage;
  }
  return layoutItem.phase === "streaming";
}

/**
 * Layout transition for rows whose spacing shifts as neighbors arrive. Native
 * only: on web the physical bottom-anchor rise (strategy-web `animateContentRise`)
 * is the single motion boundary, so animating a row's own spacing here would fight
 * it — a freshly inserted row would land, then get eased down as a neighbor's
 * padding animates in. Web applies spacing instantly so the row animates into its
 * final position; native has no timeline rise and keeps the per-row transition.
 */
export function chatLayoutTransition() {
  if (isWeb) {
    return undefined;
  }
  return LinearTransition.duration(CHAT_ENTRY_DURATION_MS).easing(CHAT_ENTRY_EASING);
}

interface ChatEntryMotionProps {
  children: ReactNode;
  animateOnMount?: boolean;
  revision?: string | number;
  /**
   * Snap to rest and suppress entry motion. Set once a newer sibling supersedes
   * this one during a burst, so only the most recent arrival animates and the
   * backlog reads immediately. Readability beats fading every row at once.
   */
  settle?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  dataSet?: Record<string, string>;
}

function playEntry(progress: SharedValue<number>) {
  cancelAnimation(progress);
  progress.value = 0;
  progress.value = withTiming(1, {
    duration: CHAT_ENTRY_DURATION_MS,
    easing: CHAT_ENTRY_EASING,
    reduceMotion: ReduceMotion.System,
  });
}

function observeChatViewportEntry(element: HTMLElement, onVisible: () => void): () => void {
  const root = element.closest('[data-testid="agent-chat-scroll"]');
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onVisible();
        observer.disconnect();
      }
    },
    {
      root: root instanceof Element ? root : null,
      threshold: 0,
    },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/** Shared arrival motion for visible rows and controls inside the chat timeline. */
export function ChatEntryMotion({
  children,
  animateOnMount = true,
  revision,
  settle = false,
  style,
  testID,
  dataSet,
}: ChatEntryMotionProps) {
  const hostElementRef = useRef<HTMLElement | null>(null);
  const setHostRef = useCallback((node: unknown) => {
    hostElementRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);
  const hasMounted = useRef(false);
  const hasPlayedEntry = useRef(false);
  const previousRevision = useRef(revision);
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const animateOnMountRef = useRef(animateOnMount);
  animateOnMountRef.current = animateOnMount;
  const progress = useSharedValue(animateOnMount && !settle ? 0 : 1);

  // A row superseded before or during its entry snaps to rest. The ref guards
  // the async web play() path so a late IntersectionObserver can't replay it.
  useLayoutEffect(() => {
    if (settle) {
      cancelAnimation(progress);
      progress.value = 1;
    }
  }, [progress, settle]);

  useLayoutEffect(() => {
    let cancelled = false;

    function play() {
      if (!cancelled && !settleRef.current && animateOnMountRef.current) {
        playEntry(progress);
        hasPlayedEntry.current = true;
      }
    }

    const isMount = !hasMounted.current;
    hasMounted.current = true;
    if (isMount) {
      if (!animateOnMount) {
        return;
      }
      if (isWeb && typeof IntersectionObserver === "function") {
        const node = hostElementRef.current;
        if (node) {
          const disconnect = observeChatViewportEntry(node, play);
          return () => {
            cancelled = true;
            disconnect();
          };
        }
      }
      play();
      return () => {
        cancelled = true;
      };
    }

    // Eligibility can end while the row is still waiting for the chat viewport.
    // Disconnecting that observer without this snap leaves progress at 0, so a
    // completed off-screen row stays transparent after the user scrolls to it.
    if (!animateOnMount) {
      if (!hasPlayedEntry.current) {
        cancelAnimation(progress);
        progress.value = 1;
        hasPlayedEntry.current = true;
      }
      return;
    }

    // A row can mount a render before its own eligibility catches up — e.g. a
    // just-sent user message whose optimistic-pending bookkeeping lands a tick
    // behind the row itself. Give it one chance to play once `animateOnMount`
    // turns true instead of locking it out based on what it measured at mount.
    if (!hasPlayedEntry.current) {
      play();
      return () => {
        cancelled = true;
      };
    }

    if (Object.is(previousRevision.current, revision)) {
      return;
    }
    previousRevision.current = revision;
    if (revision === undefined) {
      return;
    }
    play();
    return () => {
      cancelled = true;
    };
  }, [animateOnMount, progress, revision]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: CHAT_ENTRY_OFFSET_PX * (1 - progress.value) }],
  }));

  return (
    <Animated.View
      ref={setHostRef}
      style={[style, animatedStyle]}
      testID={testID}
      dataSet={dataSet}
    >
      {children}
    </Animated.View>
  );
}

interface ChatGrowthClipProps {
  children: ReactNode;
  enabled: boolean;
  /**
   * Ease the first measured height from 0. Tool-call details use this so a
   * completed diff or grouped file-edit list rises in instead of popping at
   * full height. Streaming markdown keeps the default snap: its first line is
   * already on screen inside the live block.
   */
  easeInitial?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ApplyGrowthHeightOptions {
  easeInitial?: boolean;
}

export function applyGrowthHeight(
  height: SharedValue<number>,
  contentHeightRef: { current: number | null },
  nextHeight: number,
  options?: ApplyGrowthHeightOptions,
) {
  if (nextHeight <= 0) {
    return;
  }
  const previousHeight = contentHeightRef.current;
  if (previousHeight !== null && Math.abs(nextHeight - previousHeight) <= 0.5) {
    return;
  }
  contentHeightRef.current = nextHeight;
  if (previousHeight === null) {
    cancelAnimation(height);
    if (options?.easeInitial) {
      height.value = 0;
      height.value = withTiming(nextHeight, {
        duration: CHAT_ENTRY_DURATION_MS,
        easing: CHAT_ENTRY_EASING,
        reduceMotion: ReduceMotion.System,
      });
      return;
    }
    height.value = nextHeight;
    return;
  }
  if (nextHeight <= previousHeight + 0.5) {
    cancelAnimation(height);
    height.value = nextHeight;
    return;
  }
  // Continue from the in-flight height. Snapping to the last target made
  // character-paced reveal restart a 160ms ease every frame, which reads as
  // stutter. A burst still eases the remaining distance on the shared curve.
  cancelAnimation(height);
  height.value = withTiming(nextHeight, {
    duration: CHAT_ENTRY_DURATION_MS,
    easing: CHAT_ENTRY_EASING,
    reduceMotion: ReduceMotion.System,
  });
}

/** Clips in-place markdown growth so wrapped lines rise into view instead of popping. */
export function ChatGrowthClip({
  children,
  enabled,
  easeInitial = false,
  onLayout,
  style,
  testID,
}: ChatGrowthClipProps) {
  const contentHeightRef = useRef<number | null>(null);
  const innerElementRef = useRef<HTMLElement | null>(null);
  const height = useSharedValue(-1);
  const setInnerRef = useCallback((node: unknown) => {
    innerElementRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);

  const applyMeasuredHeight = useCallback(
    (nextHeight: number) => {
      applyGrowthHeight(height, contentHeightRef, nextHeight, { easeInitial });
    },
    [easeInitial, height],
  );

  const handleInnerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      if (!isWeb) {
        applyMeasuredHeight(event.nativeEvent.layout.height);
      }
    },
    [applyMeasuredHeight, onLayout],
  );

  useLayoutEffect(() => {
    if (!enabled || !isWeb || typeof ResizeObserver !== "function") {
      return;
    }
    const node = innerElementRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        applyMeasuredHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    applyMeasuredHeight(node.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [applyMeasuredHeight, enabled]);

  const clipStyle = useAnimatedStyle(() => {
    if (height.value < 0) {
      return { overflow: "hidden" };
    }
    return {
      height: height.value,
      overflow: "hidden",
    };
  });

  if (!enabled) {
    return (
      <View onLayout={onLayout} style={style}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={[style, clipStyle]} testID={testID}>
      <View ref={setInnerRef} collapsable={false} onLayout={handleInnerLayout}>
        {children}
      </View>
    </Animated.View>
  );
}
