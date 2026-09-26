import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Text, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import { isWeb } from "@/constants/platform";
import { MOTION_ARRIVE_CSS, MOTION_STREAM_WORD_FADE_DURATION_MS } from "@/styles/motion-tokens";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import { splitGrowingLabel } from "./growing-label-parts";

interface GrowingLabelProps {
  text: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  fadeIncoming?: boolean;
}

const GROWING_LABEL_CHUNK_SCALE = 0.9;
const GROWING_LABEL_CHUNK_TRANSITION = `opacity ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}, transform ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ${MOTION_ARRIVE_CSS}`;
// `transform` only applies to inline elements that are also `inline-block`
// (or a replaced element) per the CSS Transforms spec -- a plain nested span
// ignores it otherwise.
const growingLabelChunkHiddenStyle = inlineUnistylesStyle({
  display: "inline-block" as TextStyle["display"],
  transformOrigin: "left center",
  opacity: 0,
  transform: [{ scaleX: GROWING_LABEL_CHUNK_SCALE }],
  transition: GROWING_LABEL_CHUNK_TRANSITION,
});
const growingLabelChunkVisibleStyle = inlineUnistylesStyle({
  display: "inline-block" as TextStyle["display"],
  transformOrigin: "left center",
  opacity: 1,
  transform: [{ scaleX: 1 }],
  transition: GROWING_LABEL_CHUNK_TRANSITION,
});

/**
 * A chunk starts at its target's opposite (hidden if growing in, visible if
 * about to shrink out) and flips right after mount so the CSS transition has
 * two committed frames to animate between -- the same state-toggle fix used
 * for stream word fades, extended with a horizontal scale so the subsection
 * reads as expanding or collapsing, not just fading.
 */
function GrowingLabelChunk({
  text,
  target,
  onExited,
}: {
  text: string;
  target: boolean;
  onExited?: () => void;
}) {
  const [revealed, setRevealed] = useState(!target);
  useEffect(() => {
    setRevealed(target);
    if (target || !onExited) {
      return undefined;
    }
    const timer = setTimeout(onExited, MOTION_STREAM_WORD_FADE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [target, onExited]);
  return (
    <Text style={revealed ? growingLabelChunkVisibleStyle : growingLabelChunkHiddenStyle}>
      {text}
    </Text>
  );
}

/**
 * An animated width clip used to sit here so a growing label eased toward its
 * new size instead of snapping. At streaming speed the clip could never catch
 * up to the text, so `numberOfLines={1}` permanently truncated it to "..." --
 * a label just needs to size to its content immediately, like it did before
 * that clip existed. The new suffix still grows in (and a removed suffix
 * shrinks out) via GrowingLabelChunk, just without constraining the whole
 * label's width.
 */
export function GrowingLabel({
  text,
  style,
  numberOfLines,
  onLayout,
  fadeIncoming = true,
}: GrowingLabelProps) {
  const previousTextRef = useRef("");
  const parts = splitGrowingLabel(previousTextRef.current, text);
  const [outgoingChunk, setOutgoingChunk] = useState<{ key: number; text: string } | null>(null);
  const outgoingKeyRef = useRef(0);

  useLayoutEffect(() => {
    if (fadeIncoming && isWeb && parts.outgoing.length > 0) {
      outgoingKeyRef.current += 1;
      setOutgoingChunk({ key: outgoingKeyRef.current, text: parts.outgoing });
    }
    previousTextRef.current = text;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parts is derived from text each render
  }, [text, fadeIncoming]);

  const handleOutgoingExited = useCallback(() => setOutgoingChunk(null), []);

  const incoming: ReactNode =
    fadeIncoming && isWeb && parts.incoming.length > 0 ? (
      <GrowingLabelChunk
        key={`in-${previousTextRef.current.length}`}
        text={parts.incoming}
        target
      />
    ) : (
      parts.incoming
    );

  return (
    <Text style={style} numberOfLines={numberOfLines} onLayout={onLayout}>
      {parts.prefix}
      {outgoingChunk ? (
        <GrowingLabelChunk
          key={outgoingChunk.key}
          text={outgoingChunk.text}
          target={false}
          onExited={handleOutgoingExited}
        />
      ) : null}
      {incoming}
    </Text>
  );
}
