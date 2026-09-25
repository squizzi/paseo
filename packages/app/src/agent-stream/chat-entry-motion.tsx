import React, { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { isWeb } from "@/constants/platform";
import { applyGrowthSize } from "@/components/collapse-clip-motion";
import { useObservedSize } from "@/hooks/use-observed-size";
import {
  MOTION_ARRIVE_DURATION_MS,
  MOTION_ARRIVE_EASING,
  MOTION_ARRIVE_OFFSET_PX,
  MOTION_ARRIVE_TIMING,
  MOTION_CLIP_AUTO,
  resolveArriveFadeStyle,
  resolveGrowthClipFrameStyle,
  resolveStreamBurstDuration,
} from "@/styles/motion";
import type { StreamItem } from "@/types/stream";
import type { StreamLayoutItem } from "./layout";

export const CHAT_ENTRY_DURATION_MS = MOTION_ARRIVE_DURATION_MS;
/** Shared arrive curve for row fade+rise. Growth clip uses arrive or burst. */
export const CHAT_ENTRY_EASING = MOTION_ARRIVE_EASING;
const CHAT_ENTRY_OFFSET_PX = MOTION_ARRIVE_OFFSET_PX;

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
  // animation dies when the provider echoes the message before the arrive window.
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
  delayMs?: number;
  offsetPx?: number;
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

function playEntry(progress: SharedValue<number>, delayMs: number) {
  cancelAnimation(progress);
  progress.value = 0;
  const timing = withTiming(1, MOTION_ARRIVE_TIMING);
  progress.value = delayMs > 0 ? withDelay(delayMs, timing) : timing;
}

/** Shared arrival motion for visible rows and controls inside the chat timeline. */
export function ChatEntryMotion({
  children,
  animateOnMount = true,
  revision,
  delayMs = 0,
  offsetPx = CHAT_ENTRY_OFFSET_PX,
  settle = false,
  style,
  testID,
  dataSet,
}: ChatEntryMotionProps) {
  const hasMounted = useRef(false);
  const hasPlayedEntry = useRef(false);
  const previousRevision = useRef(revision);
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const animateOnMountRef = useRef(animateOnMount);
  animateOnMountRef.current = animateOnMount;
  const delayMsRef = useRef(delayMs);
  delayMsRef.current = delayMs;
  const progress = useSharedValue(animateOnMount && !settle ? 0 : 1);

  // A row superseded before or during its entry snaps to rest.
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
        playEntry(progress, delayMsRef.current);
        hasPlayedEntry.current = true;
      }
    }

    const isMount = !hasMounted.current;
    hasMounted.current = true;
    if (isMount) {
      if (!animateOnMount) {
        return;
      }
      // Play on mount. Waiting for IntersectionObserver left sent rows at
      // opacity 0 behind the timeline clip until eligibility ended and snapped.
      play();
      return () => {
        cancelled = true;
      };
    }

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

  const animatedStyle = useAnimatedStyle(() => resolveArriveFadeStyle(progress.value, offsetPx));

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID} dataSet={dataSet}>
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
  const height = useSharedValue(MOTION_CLIP_AUTO);

  const applyMeasuredHeight = useCallback(
    (nextHeight: number) => {
      applyGrowthSize(height, contentHeightRef, nextHeight, {
        easeInitial,
        resolveDuration: resolveStreamBurstDuration,
      });
    },
    [easeInitial, height],
  );

  const { setNodeRef, onLayout: onObservedLayout } = useObservedSize({
    enabled,
    axis: "height",
    onSize: applyMeasuredHeight,
  });

  const handleInnerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      onObservedLayout(event);
    },
    [onLayout, onObservedLayout],
  );

  const clipStyle = useAnimatedStyle(() => resolveGrowthClipFrameStyle(height.value, "height"));

  if (!enabled) {
    return (
      <View onLayout={onLayout} style={style}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={[style, clipStyle]} testID={testID}>
      <View ref={setNodeRef} collapsable={false} onLayout={handleInnerLayout}>
        {children}
      </View>
    </Animated.View>
  );
}
