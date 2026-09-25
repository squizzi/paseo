import { useEffect, type ReactNode } from "react";
import { Text } from "react-native";
import { isWeb } from "@/constants/platform";
import { MOTION_ARRIVE_CSS, MOTION_BURST_DURATION_MS } from "@/styles/motion-tokens";

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

const STREAM_WORD_FADE_KEYFRAME_ID = "paseo-stream-word-fade-keyframes";
const STREAM_WORD_FADE_ANIMATION_NAME = "paseo-stream-word-fade";
const STREAM_WORD_FADE_KEYFRAME_CSS = `
  @keyframes ${STREAM_WORD_FADE_ANIMATION_NAME} {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  [data-stream-word-fade="true"] {
    animation: ${STREAM_WORD_FADE_ANIMATION_NAME} ${MOTION_BURST_DURATION_MS}ms ${MOTION_ARRIVE_CSS} both;
  }
`;

let streamWordFadeRegistered = false;

function ensureStreamWordFadeKeyframes() {
  if (!isWeb || typeof document === "undefined") {
    return;
  }
  const existing = document.getElementById(STREAM_WORD_FADE_KEYFRAME_ID);
  if (existing) {
    if (existing.textContent !== STREAM_WORD_FADE_KEYFRAME_CSS) {
      existing.textContent = STREAM_WORD_FADE_KEYFRAME_CSS;
    }
    streamWordFadeRegistered = true;
    return;
  }
  if (streamWordFadeRegistered) {
    return;
  }
  const styleElement = document.createElement("style");
  styleElement.id = STREAM_WORD_FADE_KEYFRAME_ID;
  styleElement.textContent = STREAM_WORD_FADE_KEYFRAME_CSS;
  document.head.appendChild(styleElement);
  streamWordFadeRegistered = true;
}

const STREAM_WORD_FADE_DATASET = { streamWordFade: "true" };

function StreamWord({ children }: { children: string }) {
  return <Text dataSet={STREAM_WORD_FADE_DATASET}>{children}</Text>;
}

/**
 * Fade each newly revealed word once. Tokens are keyed by source offset so a
 * word that is still being typed keeps its node, and a longer tail cannot
 * restart opacity on earlier words.
 *
 * Web only: iOS UITextView drops nested animated views, and a remounting fade
 * on the whole span is the flash this exists to avoid.
 */
export function StreamWordFade({ text, enabled }: { text: string; enabled: boolean }): ReactNode {
  useEffect(() => {
    if (enabled) {
      ensureStreamWordFadeKeyframes();
    }
  }, [enabled]);
  if (!enabled || !isWeb) {
    return text;
  }
  const tokens = splitStreamWordTokens(text);
  let cursor = 0;
  return tokens.map((token) => {
    const start = cursor;
    cursor += token.length;
    return <StreamWord key={`t${start}`}>{token}</StreamWord>;
  });
}
