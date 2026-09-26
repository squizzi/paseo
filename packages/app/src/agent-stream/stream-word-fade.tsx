import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { isWeb } from "@/constants/platform";
import {
  MOTION_ARRIVE_CSS,
  MOTION_STREAM_WORD_FADE_DURATION_MS,
  type ChatMotionOrigin,
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

// A barely-perceptible scale and rise ride along with the opacity fade so the
// word reads as sliding off the chat entry window and easing into place rather
// than materializing or fading in from the middle. Easing emanates from the
// bottom-left for assistant responses and top-right for chat bubbles.
const STREAM_WORD_FADE_SCALE = 0.98;
const STREAM_WORD_FADE_OFFSET_PX = 2;
const STREAM_WORD_FADE_TRANSITION = `opacity ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}, transform ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}`;
// Kept plain `inline` (not `inline-block`): every whitespace run streams as
// its own token too, and forcing those into inline-block boxes changes how
// the browser finds line-break opportunities across hundreds of small spans.
// Plain inline spans still apply `transform` in every browser this ships to.
const streamWordBottomLeftHiddenStyle = inlineUnistylesStyle({
  opacity: 0,
  transformOrigin: "bottom left",
  transform: [{ translateY: STREAM_WORD_FADE_OFFSET_PX }, { scale: STREAM_WORD_FADE_SCALE }],
  transition: STREAM_WORD_FADE_TRANSITION,
});
const streamWordBottomLeftVisibleStyle = inlineUnistylesStyle({
  opacity: 1,
  transformOrigin: "bottom left",
  transform: [{ translateY: 0 }, { scale: 1 }],
  transition: STREAM_WORD_FADE_TRANSITION,
});

const streamWordTopRightHiddenStyle = inlineUnistylesStyle({
  opacity: 0,
  transformOrigin: "top right",
  transform: [{ translateY: STREAM_WORD_FADE_OFFSET_PX }, { scale: STREAM_WORD_FADE_SCALE }],
  transition: STREAM_WORD_FADE_TRANSITION,
});
const streamWordTopRightVisibleStyle = inlineUnistylesStyle({
  opacity: 1,
  transformOrigin: "top right",
  transform: [{ translateY: 0 }, { scale: 1 }],
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
function StreamWord({
  children,
  origin = "bottom-left",
}: {
  children: string;
  origin?: ChatMotionOrigin;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);
  const style = useMemo(() => {
    const isTopRight = origin === "top-right";
    if (isTopRight) {
      return visible ? streamWordTopRightVisibleStyle : streamWordTopRightHiddenStyle;
    }
    return visible ? streamWordBottomLeftVisibleStyle : streamWordBottomLeftHiddenStyle;
  }, [visible, origin]);
  return <Text style={style}>{children}</Text>;
}

/**
 * Fade each newly revealed word once. Tokens are keyed by source offset so a
 * word that is still being typed keeps its node, and a longer tail cannot
 * restart opacity on earlier words.
 *
 * Web only: iOS UITextView drops nested animated views, and a remounting fade
 * on the whole span is the flash this exists to avoid.
 */
export function StreamWordFade({
  text,
  enabled,
  origin = "bottom-left",
}: {
  text: string;
  enabled: boolean;
  origin?: ChatMotionOrigin;
}): ReactNode {
  if (!enabled || !isWeb) {
    return text;
  }
  const tokens = splitStreamWordTokens(text);
  let cursor = 0;
  return tokens.map((token) => {
    const start = cursor;
    cursor += token.length;
    if (/^\s+$/.test(token)) {
      return <Text key={`t${start}`}>{token}</Text>;
    }
    return (
      <StreamWord key={`t${start}`} origin={origin}>
        {token}
      </StreamWord>
    );
  });
}
