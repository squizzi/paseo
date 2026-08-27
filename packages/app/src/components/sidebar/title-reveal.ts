import { beginTextReveal, type TextRevealState } from "@/agent-stream/text-reveal";

/**
 * A renamed title is a replacement, not growth of the same string. Retype from
 * the first character so a rename that keeps the old prefix still plays, and a
 * rename that shortens to a prefix is not already settled.
 *
 * `replay` covers the case where the displayed string does not change — setting
 * a custom title equal to the derived name — and still needs a type-in.
 */
export function retargetTitleReveal(
  state: TextRevealState,
  text: string,
  replay = false,
): TextRevealState {
  if (replay) {
    return { target: text, revealed: 0 };
  }
  if (state.target === text) {
    return state;
  }
  if (state.target.length === 0) {
    return beginTextReveal(text);
  }
  return { target: text, revealed: 0 };
}
