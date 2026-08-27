import { useEffect, useState } from "react";
import { CHAT_ENTRY_CSS, CHAT_ENTRY_DURATION_MS } from "@/styles/motion-tokens";

export const CHAT_OUTLINE_RAIL_WIDTH = 36;

const RAIL_REVEAL_TRANSITION = `opacity ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}, transform ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}`;

export interface ChatOutlineRailRevealStyle {
  opacity: number;
  transform: [{ translateX: number }];
  transition: string;
  visibility: "hidden" | "visible";
}

export function resolveChatOutlineRailRevealStyle(input: {
  revealed: boolean;
  mounted: boolean;
  reducedMotion: boolean;
}): ChatOutlineRailRevealStyle {
  return {
    opacity: input.revealed ? 1 : 0,
    transform: [{ translateX: input.revealed ? 0 : -CHAT_OUTLINE_RAIL_WIDTH }],
    visibility: input.mounted ? "visible" : "hidden",
    transition: input.reducedMotion ? "none" : RAIL_REVEAL_TRANSITION,
  };
}

/**
 * The rail node stays in the tree so slide-in is a style change on an
 * already-painted hidden frame, not a mount at rest. `mounted` only flips
 * visibility after the slide-out, so the hiding animation can play and the
 * settled rail is not treated as visible.
 *
 * Reveal waits until the next effect after `mounted` so the off-screen pose
 * paints before the 320ms chat-entry transition runs.
 */
export function useChatOutlineRailReveal(
  visible: boolean,
  reducedMotion: boolean,
): {
  mounted: boolean;
  revealed: boolean;
} {
  const [mounted, setMounted] = useState(visible);
  const [revealed, setRevealed] = useState(reducedMotion ? visible : false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reducedMotion) {
        setRevealed(true);
      }
      return undefined;
    }
    setRevealed(false);
    if (reducedMotion) {
      setMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), CHAT_ENTRY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, visible]);

  useEffect(() => {
    if (visible && mounted && !reducedMotion) {
      setRevealed(true);
    }
  }, [mounted, reducedMotion, visible]);

  return { mounted, revealed };
}
