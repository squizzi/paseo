import { useCallback, useLayoutEffect, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { isWeb } from "@/constants/platform";

export type ObservedSizeAxis = "width" | "height";

/**
 * Web uses ResizeObserver so sub-pixel growth is not missed between RN layouts.
 * Native reads the same axis from onLayout. Pass `revision` to re-attach after
 * content identity changes (a label string, for example).
 */
export function useObservedSize(input: {
  enabled: boolean;
  axis: ObservedSizeAxis;
  onSize: (size: number) => void;
  revision?: string | number | boolean;
}): {
  setNodeRef: (node: unknown) => void;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const nodeRef = useRef<HTMLElement | null>(null);
  const axis = input.axis;
  const onSize = input.onSize;
  const enabled = input.enabled;

  const setNodeRef = useCallback((node: unknown) => {
    nodeRef.current = isWeb && node instanceof HTMLElement ? node : null;
  }, []);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isWeb) {
        onSize(event.nativeEvent.layout[axis]);
      }
    },
    [axis, onSize],
  );

  useLayoutEffect(() => {
    if (!enabled || !isWeb || typeof ResizeObserver !== "function") {
      return;
    }
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        onSize(entry.contentRect[axis]);
      }
    });
    observer.observe(node);
    onSize(node.getBoundingClientRect()[axis]);
    return () => observer.disconnect();
  }, [axis, enabled, input.revision, onSize]);

  return { setNodeRef, onLayout };
}
