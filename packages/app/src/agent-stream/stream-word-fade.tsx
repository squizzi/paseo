import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { isWeb } from "@/constants/platform";
import {
  MOTION_ARRIVE_CSS,
  MOTION_STAGGER_MS,
  MOTION_STREAM_WORD_FADE_DURATION_MS,
} from "@/styles/motion-tokens";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";

/**
 * Split streaming text into stable word tokens. Key by source offset in
 * StreamWordFade so a word that is still being typed does not remount.
 */
export function splitStreamWordTokens(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

// A barely-perceptible scale rides along with the opacity fade -- almost
// invisible on its own, but it reads as the word settling into place rather
// than just materializing, and matches the scale used on chat row arrival.
const STREAM_WORD_FADE_SCALE = 0.98;
const STREAM_WORD_FADE_TRANSITION = `opacity ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}, transform ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}`;
// A whole burst of new words (the daemon coalesces one message per 60ms
// window, which can carry several words at fast generation speed) all
// mounted at once and faded in lockstep -- a synchronized block-pop rather
// than a stream. Staggering each new word's start lets it begin while the
// previous one is still mid-fade, so the reveal reads as one continuous flow
// instead of discrete steps. Capped so a huge burst doesn't visibly lag the
// last word.
const STREAM_WORD_STAGGER_STEP_CAP = 6;
// Kept plain `inline` (not `inline-block`): every whitespace run streams as
// its own token too, and forcing those into inline-block boxes changes how
// the browser finds line-break opportunities across hundreds of small spans.
// Plain inline spans still apply `transform` in every browser this ships to.
const streamWordHiddenStyle = inlineUnistylesStyle({
  opacity: 0,
  transform: [{ scale: STREAM_WORD_FADE_SCALE }],
  transition: STREAM_WORD_FADE_TRANSITION,
});
const streamWordVisibleStyle = inlineUnistylesStyle({
  opacity: 1,
  transform: [{ scale: 1 }],
  transition: STREAM_WORD_FADE_TRANSITION,
});

/**
 * A `@keyframes` animation applied via an attribute-selector rule was tried
 * first, with `both` fill mode so the element starts at the `from` opacity.
 * That fill mode locks the element at opacity 0 the moment the rule matches,
 * whether or not the animation ever actually plays -- a stylesheet insert
 * that lands a frame late, or a batched mount, left words permanently
 * invisible with no fallback. Toggling opacity from React state removes that
 * window: the hidden style paints once, an effect flips it after mount, and
 * the browser always has both endpoints to transition between.
 */
function StreamWord({ children, delayMs }: { children: string; delayMs: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);
  const style = useMemo(() => {
    if (delayMs === 0) {
      return visible ? streamWordVisibleStyle : streamWordHiddenStyle;
    }
    // The delay lives inside the `transition` shorthand itself (its 4th
    // value), not a separate `transitionDelay` property -- RNW warns on
    // mixing the shorthand with that longhand and silently drops
    // `transitionDelay` to resolve the conflict, which also meant the
    // stagger never actually took effect.
    const delayedTransition = `opacity ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS} ${delayMs}ms, transform ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS} ${delayMs}ms`;
    return inlineUnistylesStyle({
      opacity: visible ? 1 : 0,
      transform: [{ scale: visible ? 1 : STREAM_WORD_FADE_SCALE }],
      transition: delayedTransition,
    });
  }, [visible, delayMs]);
  return <Text style={style}>{children}</Text>;
}

/**
 * Fade each newly revealed word once. Tokens are keyed by source offset so a
 * word that is still being typed keeps its node, and a longer tail cannot
 * restart opacity on earlier words. Words that arrived in an earlier render
 * are already mounted and keep their own key, so only the new tail of a
 * render gets staggered.
 *
 * Web only: iOS UITextView drops nested animated views, and a remounting fade
 * on the whole span is the flash this exists to avoid.
 */
export function StreamWordFade({ text, enabled }: { text: string; enabled: boolean }): ReactNode {
  const previousLengthRef = useRef(0);
  if (!enabled || !isWeb) {
    previousLengthRef.current = text.length;
    return text;
  }
  const previousLength = previousLengthRef.current;
  previousLengthRef.current = text.length;
  const tokens = splitStreamWordTokens(text);
  let cursor = 0;
  let newTokenIndex = 0;
  return tokens.map((token) => {
    const start = cursor;
    cursor += token.length;
    const isNew = start >= previousLength;
    const delayMs = isNew
      ? Math.min(newTokenIndex++, STREAM_WORD_STAGGER_STEP_CAP) * MOTION_STAGGER_MS
      : 0;
    return (
      <StreamWord key={`t${start}`} delayMs={delayMs}>
        {token}
      </StreamWord>
    );
  });
}
