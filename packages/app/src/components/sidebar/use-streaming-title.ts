import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import {
  advanceTextReveal,
  beginTextReveal,
  completeTextReveal,
  isTextRevealPacingSupported,
  isTextRevealSettled,
  nextTextRevealFrame,
  type TextRevealState,
  visibleRevealedText,
} from "@/agent-stream/text-reveal";
import { retargetTitleReveal } from "@/components/sidebar/title-reveal";

/**
 * Paints a title the way chat paints a stream: first sight is whole, a later
 * replacement types in from the start on a 60Hz clock.
 *
 * `replayKey` changes when a rename happens even if the displayed string does
 * not — a custom title equal to the derived name.
 */
export function useStreamingTitle(text: string, replayKey?: string | null): string {
  const pacingSupported = isTextRevealPacingSupported();
  const reducedMotion = useReducedMotion();
  const stateRef = useRef<TextRevealState>(beginTextReveal(text));
  const replayKeyRef = useRef(replayKey);
  const [, forceRender] = useState(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);

  const replay = !Object.is(replayKeyRef.current, replayKey);
  replayKeyRef.current = replayKey;
  stateRef.current = retargetTitleReveal(stateRef.current, text, replay);

  useEffect(() => {
    lastFrameAtRef.current = null;

    const settle = () => {
      lastFrameAtRef.current = null;
      const next = completeTextReveal(stateRef.current);
      if (next !== stateRef.current) {
        stateRef.current = next;
        forceRender((tick) => tick + 1);
      }
    };

    if (!pacingSupported || reducedMotion === true) {
      settle();
      return;
    }
    if (isTextRevealSettled(stateRef.current)) {
      return;
    }
    if (typeof requestAnimationFrame !== "function") {
      settle();
      return;
    }

    const tick = (timestamp: number) => {
      frameRef.current = null;
      const frame = nextTextRevealFrame(lastFrameAtRef.current, timestamp);
      if (!frame) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameAtRef.current = frame.frameAtMs;

      const next = advanceTextReveal(stateRef.current, frame.elapsedMs);
      if (next !== stateRef.current) {
        stateRef.current = next;
        forceRender((count) => count + 1);
      }
      if (!isTextRevealSettled(stateRef.current)) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      lastFrameAtRef.current = null;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [pacingSupported, reducedMotion, replayKey, text]);

  if (!pacingSupported || reducedMotion === true) {
    return text;
  }
  return visibleRevealedText(stateRef.current, { streaming: true });
}
