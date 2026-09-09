import {
  beginTextReveal,
  clampToSafeRevealBoundary,
  type TextRevealState,
} from "@/agent-stream/text-reveal";

/**
 * A renamed title is a different string, not growth of the same one. Keep the
 * shared prefix (so "Investigate search" → "Investigate bugs" only types the
 * tail) and stream the rest the way chat paces newly arrived characters.
 */
export function retargetTitleReveal(state: TextRevealState, text: string): TextRevealState {
  if (state.target === text) {
    return state;
  }
  if (state.target.length === 0) {
    return beginTextReveal(text);
  }
  return {
    target: text,
    revealed: sharedPrefixLength(state.target, text),
  };
}

function sharedPrefixLength(current: string, next: string): number {
  const limit = Math.min(current.length, next.length);
  let index = 0;
  while (index < limit && current[index] === next[index]) {
    index += 1;
  }
  return clampToSafeRevealBoundary(next, index);
}
