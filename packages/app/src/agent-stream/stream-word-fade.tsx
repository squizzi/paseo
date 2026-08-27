import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { isWeb } from "@/constants/platform";
import { MOTION_STREAM_WORD_FADE_DURATION_MS } from "@/styles/motion-tokens";

export interface StreamFadeChunk {
  start: number;
  text: string;
}

export interface StreamFadeState {
  committed: string;
  chunks: StreamFadeChunk[];
}

interface StreamWordFadeProps {
  text: string;
  enabled: boolean;
  renderCommitted?: (committed: string) => ReactNode;
  tokenStyle?: StyleProp<TextStyle>;
}

interface StreamTokChunkProps {
  text: string;
}

interface StreamTokHostProps {
  committed: string;
  chunks: StreamFadeChunk[];
  style?: StyleProp<TextStyle>;
  hostRef: (node: unknown) => void;
}

export interface StreamTokAnimation {
  finished: Promise<unknown>;
}

export interface StreamTokAnimationHost {
  getAnimations: (options: { subtree: boolean }) => StreamTokAnimation[];
}

export function waitForStreamTokAnimations(host: StreamTokAnimationHost): Promise<void> {
  const animations = host.getAnimations({ subtree: true });
  if (animations.length === 0) {
    return Promise.resolve();
  }
  return Promise.all(
    animations.map((animation) =>
      animation.finished.then(
        () => undefined,
        () => undefined,
      ),
    ),
  ).then(() => undefined);
}

const EMPTY_STREAM_FADE_CHUNKS: StreamFadeChunk[] = [];

export function nextStreamFadeState(
  state: StreamFadeState,
  text: string,
  enabled: boolean,
): StreamFadeState {
  if (!enabled) {
    if (state.chunks.length === 0 && state.committed === text) {
      return state;
    }
    return { committed: text, chunks: EMPTY_STREAM_FADE_CHUNKS };
  }

  const visible = state.committed + state.chunks.map((chunk) => chunk.text).join("");
  if (text === visible) {
    return state;
  }

  if (text.startsWith(visible)) {
    return {
      committed: state.committed,
      chunks: [...state.chunks, { start: visible.length, text: text.slice(visible.length) }],
    };
  }

  // Upstream rewrote earlier text. Snap to visible rather than replaying fades.
  return { committed: text, chunks: EMPTY_STREAM_FADE_CHUNKS };
}

export interface FadingTextPiece {
  start: number;
  text: string;
  fade: boolean;
}

export interface MarkdownTextSourceCursor {
  current: number;
}

export interface MarkdownTextSourceLocation {
  source: string;
  cursor: MarkdownTextSourceCursor;
  content: string;
}

export function takeMarkdownTextSourceStart(input: MarkdownTextSourceLocation): number {
  const { source, cursor, content } = input;
  if (content.length === 0) {
    return cursor.current;
  }
  const index = source.indexOf(content, cursor.current);
  if (index === -1) {
    const fallback = cursor.current;
    cursor.current += content.length;
    return fallback;
  }
  cursor.current = index + content.length;
  return index;
}

export interface SplitFadingTextInput {
  content: string;
  sourceStart: number;
  committedLength: number;
  chunks: StreamFadeChunk[];
}

export function splitFadingText(input: SplitFadingTextInput): FadingTextPiece[] {
  const { content, sourceStart, committedLength, chunks } = input;
  if (content.length === 0) {
    return [];
  }
  if (chunks.length === 0) {
    return [{ start: sourceStart, text: content, fade: false }];
  }

  const contentEnd = sourceStart + content.length;
  const pieces: FadingTextPiece[] = [];
  let cursor = sourceStart;

  function push(end: number, fade: boolean) {
    if (end <= cursor) {
      return;
    }
    pieces.push({
      start: cursor,
      text: content.slice(cursor - sourceStart, end - sourceStart),
      fade,
    });
    cursor = end;
  }

  if (committedLength > cursor) {
    const committedEnd = Math.min(committedLength, contentEnd);
    push(committedEnd, false);
  }

  for (const chunk of chunks) {
    if (cursor >= contentEnd) {
      break;
    }
    const chunkEnd = chunk.start + chunk.text.length;
    if (chunkEnd <= cursor) {
      continue;
    }
    if (chunk.start > cursor) {
      const plainEnd = Math.min(chunk.start, contentEnd);
      push(plainEnd, false);
    }
    if (cursor >= contentEnd) {
      break;
    }
    const fadeEnd = Math.min(chunkEnd, contentEnd);
    push(fadeEnd, true);
  }

  push(contentEnd, false);
  return pieces;
}

const STREAM_TOK_KEYFRAME_ID = "paseo-stream-tok-keyframes";
const STREAM_TOK_ANIMATION_NAME = "paseo-stream-tok";
const STREAM_TOK_HOST_DATASET = { paseoStreamTokHost: "true" } as const;
const STREAM_TOK_DATASET = { paseoStreamTok: "true" } as const;

export const STREAM_TOK_KEYFRAME_CSS = `
  @keyframes ${STREAM_TOK_ANIMATION_NAME} {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-paseo-stream-tok="true"] {
      animation: none !important;
      opacity: 1 !important;
    }
  }
  [data-paseo-stream-tok="true"] {
    display: inline;
    white-space: pre-wrap;
    overflow: visible;
    /* Nested RN-web Text sets font: inherit, whose line-height is normal. */
    line-height: inherit !important;
    animation: ${STREAM_TOK_ANIMATION_NAME} ${MOTION_STREAM_WORD_FADE_DURATION_MS}ms ease-out backwards;
  }
  [data-paseo-stream-tok-host="true"] {
    white-space: pre-wrap;
  }
`;

interface StreamMarkdownFadeValue {
  source: string;
  committedLength: number;
  chunks: StreamFadeChunk[];
  cursor: MarkdownTextSourceCursor;
}

const StreamMarkdownFadeContext = createContext<StreamMarkdownFadeValue | null>(null);

interface StreamMarkdownFadeScopeProps {
  source: string;
  committedLength: number;
  chunks: StreamFadeChunk[];
  children: ReactNode;
}

export function StreamMarkdownFadeScope({
  source,
  committedLength,
  chunks,
  children,
}: StreamMarkdownFadeScopeProps) {
  const cursorRef = useRef(0);
  cursorRef.current = 0;
  const value = useMemo(
    () => ({ source, committedLength, chunks, cursor: cursorRef }),
    [committedLength, chunks, source],
  );
  return (
    <StreamMarkdownFadeContext.Provider value={value}>
      {children}
    </StreamMarkdownFadeContext.Provider>
  );
}

function StreamFadeMarkdownPiece({ piece }: { piece: FadingTextPiece }) {
  if (piece.fade) {
    return <Text dataSet={STREAM_TOK_DATASET}>{piece.text}</Text>;
  }
  return piece.text;
}

export function StreamFadeMarkdownContent({ content }: { content: string }): ReactNode {
  const fade = useContext(StreamMarkdownFadeContext);
  if (fade === null || fade.chunks.length === 0) {
    return content;
  }
  const sourceStart = takeMarkdownTextSourceStart({
    source: fade.source,
    cursor: fade.cursor,
    content,
  });
  const pieces = splitFadingText({
    content,
    sourceStart,
    committedLength: fade.committedLength,
    chunks: fade.chunks,
  });
  return pieces.map((piece) => {
    const key = piece.fade ? `f:${piece.start}` : `p:${piece.start}`;
    return <StreamFadeMarkdownPiece key={key} piece={piece} />;
  });
}

let streamTokKeyframesRegistered = false;

function ensureStreamTokKeyframes() {
  if (!isWeb) {
    return;
  }
  if (typeof document === "undefined") {
    return;
  }
  const existing = document.getElementById(STREAM_TOK_KEYFRAME_ID);
  if (existing) {
    if (existing.textContent !== STREAM_TOK_KEYFRAME_CSS) {
      existing.textContent = STREAM_TOK_KEYFRAME_CSS;
    }
    streamTokKeyframesRegistered = true;
    return;
  }
  if (streamTokKeyframesRegistered) {
    return;
  }
  const styleElement = document.createElement("style");
  styleElement.id = STREAM_TOK_KEYFRAME_ID;
  styleElement.textContent = STREAM_TOK_KEYFRAME_CSS;
  document.head.appendChild(styleElement);
  streamTokKeyframesRegistered = true;
}

// Register at module scope so the first token does not race a missing @keyframes
// rule. Same reason as the tool-call shimmer in message.tsx.
ensureStreamTokKeyframes();

function StreamTokChunk({ text }: StreamTokChunkProps) {
  return <Text dataSet={STREAM_TOK_DATASET}>{text}</Text>;
}

/**
 * One Text host so chunks wrap in their final paragraph. Each chunk is a single
 * span with a single fade, keyed by absolute start offset so it never remounts.
 */
function StreamTokHost({ committed, chunks, style, hostRef }: StreamTokHostProps) {
  return (
    <Text ref={hostRef} dataSet={STREAM_TOK_HOST_DATASET} style={style}>
      {committed}
      {chunks.map((chunk) => (
        <StreamTokChunk key={chunk.start} text={chunk.text} />
      ))}
    </Text>
  );
}

/**
 * Fade each coalesced arrival as one frozen span (opacity).
 * Web only: iOS UITextView drops nested animated views.
 * Assistant messages pass `renderCommitted` so the live row is markdown
 * (lists, headings) from the first paint; fade spans split text leaves
 * keyed by arrival start so later lines still fade.
 */
export function StreamWordFade({
  text,
  enabled,
  renderCommitted,
  tokenStyle,
}: StreamWordFadeProps): ReactNode {
  const fadingEnabled = enabled && isWeb;
  const hostRef = useRef<HTMLElement | null>(null);
  const [tokensVisible, setTokensVisible] = useState(fadingEnabled);
  const keepTokens = fadingEnabled || tokensVisible;
  const [state, setState] = useState<StreamFadeState>(() =>
    nextStreamFadeState({ committed: "", chunks: EMPTY_STREAM_FADE_CHUNKS }, text, fadingEnabled),
  );
  const nextState = nextStreamFadeState(state, text, keepTokens);
  if (nextState !== state) {
    setState(nextState);
  }

  const setHostNode = useCallback((node: unknown) => {
    hostRef.current = node instanceof HTMLElement ? node : null;
  }, []);

  useLayoutEffect(() => {
    if (fadingEnabled) {
      setTokensVisible(true);
      return;
    }
    if (!tokensVisible) {
      return;
    }
    const host = hostRef.current;
    if (host === null || typeof host.getAnimations !== "function") {
      setTokensVisible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      await waitForStreamTokAnimations({
        getAnimations(options) {
          return host.getAnimations(options);
        },
      });
      if (!cancelled) {
        setTokensVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fadingEnabled, tokensVisible]);

  if (renderCommitted) {
    return (
      <StreamMarkdownFadeScope
        source={text}
        committedLength={nextState.committed.length}
        chunks={keepTokens ? nextState.chunks : EMPTY_STREAM_FADE_CHUNKS}
      >
        {renderCommitted(text)}
      </StreamMarkdownFadeScope>
    );
  }

  if (!keepTokens) {
    return text;
  }

  return (
    <StreamTokHost
      committed={nextState.committed}
      chunks={nextState.chunks}
      style={tokenStyle}
      hostRef={setHostNode}
    />
  );
}
