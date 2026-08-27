# Agent stream performance

How assistant text gets from a provider to the screen, and why arrival lumps are smoothed at render. Read this before changing `packages/server/src/server/agent/agent-stream-coalescer.ts`, the reducer queue in `packages/app/src/timeline/session-stream-reducers.ts`, the reveal in `packages/app/src/hooks/use-revealed-text.ts`, or the fade in `packages/app/src/agent-stream/stream-word-fade.tsx`.

For terminal output, which is a separate pipeline with separate budgets, see [terminal-performance.md](terminal-performance.md).

## The pipeline

```
provider deltas (every provider streams incrementally)
  → AgentStreamCoalescer (daemon, leading + trailing, ≤1 message per 60ms per agent)
  → recordTimeline: one canonical row per flushed item
  → agent_stream ws message
  → reducer queue (app, one commit per frame) → session store
  → source-item plugin transforms → native Markdown blocks / tool grouping
  → native: paced reveal (app, per displayed item) → paint
  → web: paint each coalesced arrival, fade that suffix as one span → paint
```

Every provider delivers incremental text, so there is no provider that needs special handling: Claude via `includePartialMessages`, Codex via `agent_message_delta`, ACP agents via `agent_message_chunk`, Pi and OMP via `text_delta`.

## Why arrival is smoothed at render

Arrival is lumpy and there is no fixing that at the source. A 60ms coalescing window carries however many characters the model produced in those 60ms, which swings by an order of magnitude within a single turn. Painting each delta as it lands makes the size of those lumps visible, and that is what reads as jagged.

Native paces characters: arrival sets a _target_ and the reveal rate is derived from the backlog instead. A burst makes the text catch up faster; it does not make the text jump.

Web paints each coalesced arrival as one frozen span and fades that suffix (`MOTION_STREAM_WORD_FADE_DURATION_MS`) with opacity. Do not put `filter` on those spans: on a wrapped inline fragment it clips the bottom of the line (descenders), and extra height on `ChatGrowthClip` only covers the last line of the block. Fade spans inherit line-height so nested RN-web `font: inherit` cannot collapse to `normal`, and use `backwards` fill so a finished animation cannot leave a used style that shrinks the box. Assistant live rows render streaming markdown immediately — a list item is a bullet from the first paint, not a `-` that later pops into a marker. Fade spans sit on text leaves and are keyed by arrival start, so a later wrapped line still fades; putting the animation on the block wrapper only played on first mount. One fade host owns the live row's text; presentation already peels completed Markdown blocks into their own rows, and splitting that row again inside `AssistantMessage` remounted the host and replayed the CSS fade from the start of the block. Plain-text tool details still use token spans keyed by absolute start offset so later arrivals append; they do not remount or grow the span already in flight. The stylesheet is inserted at module load so the first token does not race a missing `@keyframes` rule. `ChatGrowthClip` keeps the same wrapper tree when the clip turns off — swapping `View` for `Animated.View` remounts those spans. If upstream rewrites earlier text, the tail snaps to visible rather than replaying a fade mid-block. When streaming ends, completed blocks above the tail are static markdown. Native still paces characters because UITextView drops nested animated views.

Shrinking the coalescing window does not fix lumpiness — it makes the lumps smaller and more frequent, at the cost of message rate on a daemon loop that already contends with terminal frames and per-message relay encryption.

## Invariants

- **The coalescer is leading + trailing.** The first delta after an idle window flushes synchronously; only the rest of the burst waits for the trailing timer. Reverting to trailing-only adds a full window to the first character of every turn. Same shape and the same reason as `TerminalOutputCoalescer`.
- **The leading flush adds a canonical row, and that is fine.** A burst's first chunk lands as its own timeline row. `mergeAssistantChunks` / `mergeReasoningChunks` in `timeline-projection.ts` join contiguous same-turn rows, and clients read the projected timeline, so history is unaffected. Tests that assert on raw rows have to account for the extra row; tests that assert on what a client sees do not.
- **The store holds the full text; only the rendered slice is paced, and only on native.** Copy, selection, the chat outline, and scroll geometry all read the same string the user can see. Pacing the store instead would leave the bottom anchor chasing a content height that is ahead of the reveal. Web paints the store text immediately; opacity is a per-chunk fade.
- **Markdown blocks belong to presentation, and every assistant message is a block group.**
  `agent-stream/presentation.ts` splits a message into one display row per Markdown block, the same
  way whether it arrived streaming or as fetched history. Splitting in the reducer instead would
  discard paragraph separators and expose fragments to plugin callbacks, which need the whole source
  text. Live-head work stays cheap by parsing only the growing last block during append, retaining
  completed blocks by object identity, and caching the split per source item so a tail change does
  not re-split history. History was once left whole to keep cross-block Markdown context; that gave
  one message two shapes depending on how it arrived, and message-addressed features only worked on
  one of them.
- **A row id is never a message id.** Block rows are `${messageId}:block:${n}` with
  `blockGroupId = messageId`, including single-block messages, so nothing can come to rely on the two
  being equal. `getStreamItemMessageId` in `presentation.ts` is the only way to go from a row to its
  message, and web rows carry it as `data-message-id` alongside `data-history-row-id`. Anything
  addressing a message — chat find, scroll-to-message, history reveal, the find expansion that lifts
  the render cap — uses the message id and must expect several rows to answer to it. Row ids stay for
  React keys, virtualizer measurement, scroll anchors, and per-row caches like assistant image
  occurrence keys.
- **First sight of a text is revealed whole.** Native growth is paced; web growth is a fade of the new suffix. This is what makes history hydration, timeline replay, a virtualized row remounting on scroll, and an already-finished message all render complete on first paint without a special case for each.
- **Leaving `phase: "streaming"` snaps the reveal.** A completed turn must never be left holding characters. `layoutStream` sets the phase, so anything outside the live head with an active turn is already complete.
- **Browser bottom-follow stays physically anchored.** Do not smooth `scrollTop`: it leaves the response tail below the viewport while the animation catches up. `strategy-web.tsx` anchors first, offsets the message timeline by the anchor correction, then eases that visual offset to zero. Apply the compensation to the timeline rows, not the live turn footer, so earlier messages rise while fork and elapsed stay put for the rest of the turn. Clip that rise to the timeline's layout box (`overflow: hidden` on an untransformed wrapper) so translated tokens cannot paint over the footer. Do not pad the layout to cover the footer: extra height re-enters stick/rise. Leave the footer after the clip so `ChatGrowthClip` can still push it down while the viewport is not yet scrolling. Arrival growth happens inside an already-mounted live-head row, so that height change never invalidates `liveHead`. Stick and rise from the `ResizeObserver` callback, before paint. A later growth must start its rise before cancelling the previous one; `Animation.cancel()` drops the in-flight offset immediately, and a fast footer or first token would snap the remaining 10–20px.
- **Chat arrivals share one motion boundary.** Use `chat-entry-motion.tsx` for user-sent rows and new streaming thought/tool rows as they appear. Play on mount — waiting for IntersectionObserver left a sent row at opacity 0 behind the timeline clip until eligibility ended and snapped it in. Assistant text, permissions, and the turn footer wrapper do not fade as a row. On web, each coalesced stream suffix mounts as one frozen span that eases in (`MOTION_STREAM_WORD_FADE_DURATION_MS`); later arrivals become more spans in the same host, they do not grow the one in flight. Parsed markdown above the live tail stays put. Copy, fork, and elapsed insides stagger on the shared arrive curve only when a live turn just completed; `turn-footer-entry-motion` is the wrapper and stays opaque. Durations come from `packages/app/src/styles/motion.ts`. Wrapped lines grow inside an already-mounted block, so `ChatGrowthClip` snaps to the measured border box and ceils it. Snap growth uses `minHeight` without `overflow: hidden`; a pixel-height clip is a frame late and slices the stream fade at the bottom of a Thinking card. Measure `borderBoxSize`; `contentRect` drops leading. A settled expanded badge also leaves overflow visible (`resolveGrowthClipFrameStyle` at auto height), or the same fade is clipped at the card edge. Streaming Thinking and other plain-text tool-call details reuse that clip; a layout transition on the expanded badge would fight it. File-edit diffs and other non-plain details use the same clip while the call is running, and expandable badges ease both expansion and collapse smoothly so details do not pop or snap shut (details already open during streaming do not replay when execution settles). A loading tool-call summary sizes to its content immediately and eases width when counts grow; the shimmer sweep's duration is captured on first layout so extra words cannot restart it, but its travel span stays live so it always sweeps the label's current width. User-submitted rows animate on first appearance after history hydration, not only while the send is pending — a fast provider ack would otherwise remount the row at full opacity. Tool calls are not a streamable head kind, so a detailed-mode burst lands in history with phase complete; hydrate their ids the same way as user rows or only the first visible arrival would ease and the rest would pop. Follow-up calls inside an expanded overview use the growth clip. They do not fade in.
- **The reducer queue commits on a frame, with a timer as the ceiling.** A frame callback never fires in a hidden tab, so a timer races it and wins when nothing is painting — the store has to keep advancing either way.
- **A history row re-renders only when its item or layout item identity changes.** The inverted
  FlatList hands every mounted cell a new `index` and `ref` whenever a row is prepended, so without a
  memo boundary each coalesced tick re-rendered every mounted row (about 50 on a phone, 100–250 ms of
  JS per tick). `layoutStream` keeps a layout item's identity when nothing about it changed,
  `useRevisedHistoryRows` hands a fresh item identity to rows whose tool-call group, expanded state,
  or breakpoint changed, and `HistoryStreamRow` memoizes on both. Every viewport runs its history
  through that hook; the web viewport once skipped it and history hosts of a live tool group went
  stale. A new field on `StreamLayoutItem` must be added to `areLayoutItemsEquivalent`, or sharing
  silently stops.

## Measuring

- **Smoothness (user-perceived):** `packages/app/e2e/browser/agent-stream-smoothness.spec.ts`, gated behind `PASEO_AGENT_STREAM_PERF_E2E=1`. Drives the mock provider's `bursty-stream` model and reports coefficient of variation of characters painted per frame (smoothness) plus p95 gap between visible updates (stalls). Both numbers are needed: a stalled stream is perfectly smooth.
- **Reproducing bursty arrival:** the `bursty-stream` model in `mock-load-test-agent.ts` emits uneven runs of tokens separated by idle gaps. Burst sizes come from a seeded generator, so a run repeats exactly.
- **Rate policy in isolation:** `computeRevealStep` in `packages/app/src/agent-stream/text-reveal.ts` is pure; `text-reveal.test.ts` covers convergence and burst flattening without a renderer.

Healthy numbers (2026-08, Expo web against a local dev daemon, real Claude Haiku agent, ~8.5s samples during active streaming). Taken when web still paced characters. Native still uses that policy; web now paints coalesced arrivals and fades the suffix. Setting `TEXT_REVEAL_HORIZON_MS` to 0 makes native paint on arrival, which is how the baseline column was taken:

|                                  | paint on arrival | paced |
| -------------------------------- | ---------------- | ----- |
| frames that advanced the text    | 6%               | 87%   |
| chars-per-frame CV               | 4.11             | 1.86  |
| gap between visible updates, p50 | 317ms            | 17ms  |
| gap between visible updates, p95 | 383ms            | 17ms  |

Total characters painted is roughly the same either way — pacing changes when they land, not how many arrive.

Measure the **total** length across every `assistant-message` element, not the last one. A turn emits many assistant messages, so the tail element keeps changing identity and its length is not monotonic; sampling only the tail reads those handovers as resets and reports almost no growth. `sampleStreamFrames` does this correctly.
