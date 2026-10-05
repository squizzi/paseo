import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useAnimationsEnabled } from "@/hooks/use-settings";
import { MOTION_ARRIVE_CSS, MOTION_ARRIVE_DURATION_MS } from "@/styles/motion-tokens";
import type { ComposerHeightResult } from "./height.types";

/** Content taller than the floor by more than this counts as overflowing, not rounding noise. */
const EXPANSION_EPSILON = 0.5;

interface ComposerHeightArgs {
  getText: () => string;
  textareaRef: RefObject<HTMLElement | null>;
  minHeight: number;
  maxHeight: number;
}

const COPIED_STYLES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "whiteSpace",
  "wordWrap",
  "overflowWrap",
  "wordBreak",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

export function useComposerHeight({
  getText,
  textareaRef,
  minHeight,
  maxHeight,
}: ComposerHeightArgs): ComposerHeightResult {
  const animationsEnabled = useAnimationsEnabled();
  const [height, setHeight] = useState(minHeight);
  const heightRef = useRef(minHeight);
  const hasMeasuredRef = useRef(false);
  const paramsRef = useRef({ getText, minHeight, maxHeight });
  paramsRef.current = { getText, minHeight, maxHeight };
  const mirrorRef = useRef<HTMLTextAreaElement | null>(null);

  // Binary, not proportional: the box is either the compact floor or the full cap, never
  // something measured in between. One overflowing line is as much a reason to see the whole
  // writing surface as ten, so there is nothing worth tracking between those two sizes.
  const setExpanded = useCallback(
    (shouldExpand: boolean) => {
      const { minHeight: currentMin, maxHeight: currentMax } = paramsRef.current;
      const target = shouldExpand ? currentMax : currentMin;
      // A no-op measurement (the state isn't changing) must not count as "the first measurement"
      // -- an empty mount lands here before the box ever actually moves, and the real expansion
      // that follows still needs to be judged against a true baseline, not mistaken for it.
      const isFirstMeasurement = !hasMeasuredRef.current;
      hasMeasuredRef.current = true;
      if (Math.abs(heightRef.current - target) < 1) {
        return;
      }
      const isGrowing = target > heightRef.current;
      heightRef.current = target;
      // Ease the one expansion to the cap; everything else -- the initial measurement (whatever
      // it lands on, including a restored draft) and collapsing back down once content fits the
      // floor again -- snaps so there is exactly one transition to notice, not a repeated one.
      const shouldEase = animationsEnabled && !isFirstMeasurement && isGrowing;
      // Set directly on the node rather than through the `style` prop: this component's style
      // goes through Unistyles' own class/auto-mapping pipeline, which only understands recognized
      // RN style keys and silently drops a CSS-only property like `transitionDuration`. A direct
      // DOM write is the one path guaranteed to land, and it has to land before `setHeight` below
      // so the browser is already primed to animate the specific change that follows.
      const node = textareaRef.current;
      if (node) {
        if (shouldEase) {
          node.style.transitionProperty = "height";
          node.style.transitionDuration = `${MOTION_ARRIVE_DURATION_MS}ms`;
          node.style.transitionTimingFunction = MOTION_ARRIVE_CSS;
        } else {
          node.style.transitionDuration = "0ms";
        }
      }
      setHeight(target);
    },
    [animationsEnabled, textareaRef],
  );

  const measure = useCallback(
    (text: string) => {
      const mirror = mirrorRef.current;
      const source = textareaRef.current;
      if (!mirror || !source || typeof window === "undefined") return;
      const sourceWidth = source.clientWidth;
      if (sourceWidth <= 0) return;

      const computedStyle = window.getComputedStyle(source);
      for (const property of COPIED_STYLES) {
        mirror.style[property] = computedStyle[property];
      }
      mirror.style.width = `${sourceWidth}px`;
      mirror.value = text.endsWith("\n") ? `${text} ` : text;
      const { minHeight: currentMin } = paramsRef.current;
      setExpanded(mirror.scrollHeight > currentMin + EXPANSION_EPSILON);
    },
    [setExpanded, textareaRef],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const mirror = document.createElement("textarea");
    mirror.setAttribute("aria-hidden", "true");
    mirror.setAttribute("tabindex", "-1");
    mirror.readOnly = true;
    mirror.rows = 1;
    Object.assign(mirror.style, {
      position: "absolute",
      top: "0",
      left: "0",
      visibility: "hidden",
      pointerEvents: "none",
      overflow: "hidden",
      border: "0",
      margin: "0",
      resize: "none",
      zIndex: "-1",
      boxSizing: "border-box",
    });
    document.body.appendChild(mirror);
    mirrorRef.current = mirror;
    measure(paramsRef.current.getText());
    return () => {
      mirror.remove();
      mirrorRef.current = null;
    };
  }, [measure]);

  useLayoutEffect(() => {
    measure(getText());
  }, [maxHeight, minHeight, getText, measure]);

  useEffect(() => {
    const source = textareaRef.current;
    if (!source || typeof ResizeObserver === "undefined") return;
    let previousWidth = source.clientWidth;
    const observer = new ResizeObserver(() => {
      const nextWidth = source.clientWidth;
      if (Math.abs(nextWidth - previousWidth) < 1) return;
      previousWidth = nextWidth;
      measure(paramsRef.current.getText());
    });
    observer.observe(source);
    return () => observer.disconnect();
  }, [measure, textareaRef]);

  const onTextChange = useCallback(
    (_previousText: string, nextText: string) => measure(nextText),
    [measure],
  );
  const reset = useCallback(() => setExpanded(false), [setExpanded]);
  const style = useMemo(() => ({ height, minHeight, maxHeight }), [height, maxHeight, minHeight]);

  return {
    mode: "measured",
    style,
    scrollEnabled: height >= maxHeight,
    onTextChange,
    reset,
  };
}
