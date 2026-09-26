import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  resolveSidebarItemMotionFrameStyle,
  SIDEBAR_ITEM_MOTION_OFFSET,
} from "@/components/sidebar/item-motion";
import { MOTION_EXIT_TIMING } from "@/styles/motion";
import { isFinishedSubagent } from "./archive-finished";
import type { SubagentRow } from "./select";

/**
 * Collapses a row exactly like a sidebar row leaving the workspace list --
 * height, opacity, and a small rise, on the same exit curve -- reusing the
 * sidebar's own motion math so archiving a subagent reads as the same motion
 * as archiving a workspace, not a lookalike with its own tuning to drift out
 * of sync later.
 */
export function SubagentRowExitMotion({
  exiting,
  onExited,
  children,
}: {
  exiting: boolean;
  onExited: () => void;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion() === true;
  const measuredHeightRef = useRef(0);
  const hasStartedExitRef = useRef(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const height = useSharedValue(-1);
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    measuredHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  useLayoutEffect(() => {
    if (!exiting || hasStartedExitRef.current) {
      return;
    }
    hasStartedExitRef.current = true;
    const startHeight = measuredHeightRef.current;
    if (reducedMotion || startHeight <= 0) {
      onExitedRef.current();
      return;
    }
    height.value = startHeight;
    opacity.value = withTiming(0, MOTION_EXIT_TIMING);
    offset.value = withTiming(SIDEBAR_ITEM_MOTION_OFFSET, MOTION_EXIT_TIMING);
    height.value = withTiming(0, MOTION_EXIT_TIMING, (finished) => {
      if (finished) {
        runOnJS(onExitedRef.current)();
      }
    });
  }, [exiting, height, offset, opacity, reducedMotion]);

  const frameStyle = useAnimatedStyle(() =>
    resolveSidebarItemMotionFrameStyle({
      height: height.value,
      opacity: opacity.value,
      offset: offset.value,
    }),
  );

  return (
    <Animated.View style={frameStyle}>
      <View onLayout={handleLayout}>{children}</View>
    </Animated.View>
  );
}

const EMPTY_EXITING_IDS: ReadonlySet<string> = new Set();

/**
 * Archiving is optimistic -- a row drops out of `rows` the instant the
 * archive call fires, before any exit animation could play. This keeps a
 * snapshot of rows the caller has asked to archive and their last known
 * order, so `displayRows` can keep rendering them (running their own
 * `SubagentRowExitMotion`) for exactly as long as their collapse takes,
 * independent of how fast the underlying mutation actually resolves.
 *
 * "Archive finished" snapshots every finished row in one state update, so
 * they all flip to exiting on the same render and collapse together as one
 * block instead of trailing off as each row's own network call lands.
 */
export function useSubagentRowExitTracking(input: {
  rows: SubagentRow[];
  onArchiveSubagent: (id: string) => void;
  onArchiveFinished?: () => void;
}): {
  displayRows: SubagentRow[];
  exitingIds: ReadonlySet<string>;
  handleArchiveSubagent: (id: string) => void;
  handleArchiveFinished: () => void;
  handleRowExited: (id: string) => void;
} {
  const { rows, onArchiveSubagent, onArchiveFinished } = input;
  const [exitingIds, setExitingIds] = useState<ReadonlySet<string>>(EMPTY_EXITING_IDS);
  const snapshotRef = useRef(new Map<string, SubagentRow>());
  const orderRef = useRef<string[]>([]);

  const beginExiting = useCallback((exitingRows: SubagentRow[]) => {
    if (exitingRows.length === 0) {
      return;
    }
    for (const row of exitingRows) {
      snapshotRef.current.set(row.id, row);
    }
    setExitingIds((current) => {
      const next = new Set(current);
      for (const row of exitingRows) {
        next.add(row.id);
      }
      return next;
    });
  }, []);

  const handleArchiveSubagent = useCallback(
    (id: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row) {
        beginExiting([row]);
      }
      onArchiveSubagent(id);
    },
    [rows, onArchiveSubagent, beginExiting],
  );

  const handleArchiveFinished = useCallback(() => {
    beginExiting(rows.filter(isFinishedSubagent));
    onArchiveFinished?.();
  }, [rows, onArchiveFinished, beginExiting]);

  const handleRowExited = useCallback((id: string) => {
    snapshotRef.current.delete(id);
    setExitingIds((current) => {
      if (!current.has(id)) {
        return current;
      }
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const nextOrder = mergeSubagentDisplayOrder({
    previousOrder: orderRef.current,
    liveRowIds: rows.map((row) => row.id),
    exitingIds,
  });
  orderRef.current = nextOrder;

  const displayRows = resolveSubagentDisplayRows({
    order: nextOrder,
    liveRows: rows,
    exitingSnapshot: snapshotRef.current,
  });

  return { displayRows, exitingIds, handleArchiveSubagent, handleArchiveFinished, handleRowExited };
}

/**
 * A collapsing row must stay in its own spot, not jump to the end while it
 * shrinks: keep whatever order was already settled on, drop ids that are
 * neither live nor still exiting, then append any brand-new live id.
 */
export function mergeSubagentDisplayOrder(input: {
  previousOrder: readonly string[];
  liveRowIds: readonly string[];
  exitingIds: ReadonlySet<string>;
}): string[] {
  const liveIds = new Set(input.liveRowIds);
  const order: string[] = [];
  const seenIds = new Set<string>();
  for (const id of input.previousOrder) {
    if ((liveIds.has(id) || input.exitingIds.has(id)) && !seenIds.has(id)) {
      order.push(id);
      seenIds.add(id);
    }
  }
  for (const id of input.liveRowIds) {
    if (!seenIds.has(id)) {
      order.push(id);
      seenIds.add(id);
    }
  }
  return order;
}

/** Live data wins; a row only still exiting because it left `liveRows` falls back to its snapshot. */
export function resolveSubagentDisplayRows(input: {
  order: readonly string[];
  liveRows: readonly SubagentRow[];
  exitingSnapshot: ReadonlyMap<string, SubagentRow>;
}): SubagentRow[] {
  const rowById = new Map(input.liveRows.map((row) => [row.id, row]));
  const displayRows: SubagentRow[] = [];
  for (const id of input.order) {
    const row = rowById.get(id) ?? input.exitingSnapshot.get(id);
    if (row) {
      displayRows.push(row);
    }
  }
  return displayRows;
}
