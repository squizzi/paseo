# Agent stream performance

How assistant text gets from a provider to the screen, and why it is paced on the way. Read this before changing `packages/server/src/server/agent/agent-stream-coalescer.ts`, the reducer queue in `packages/app/src/timeline/session-stream-reducers.ts`, or the reveal in `packages/app/src/hooks/use-revealed-text.ts`.

For terminal output, which is a separate pipeline with separate budgets, see [terminal-performance.md](terminal-performance.md).

## The pipeline

```
provider deltas (every provider streams incrementally)
  → AgentStreamCoalescer (daemon, leading + trailing, ≤1 message per 60ms per agent)
  → recordTimeline: one canonical row per flushed item
  → agent_stream ws message
  → reducer queue (app, one commit per frame) → session store
  → source-item plugin transforms → native Markdown blocks / tool grouping
  → paced reveal (app, per displayed item) → paint
```

Every provider delivers incremental text, so there is no provider that needs special handling: Claude via `includePartialMessages`, Codex via `agent_message_delta`, ACP agents via `agent_message_chunk`, Pi and OMP via `text_delta`.

## Why the reveal is paced

Arrival is lumpy and there is no fixing that at the source. A 60ms coalescing window carries however many characters the model produced in those 60ms, which swings by an order of magnitude within a single turn. Painting each delta as it lands makes the size of those lumps visible, and that is what reads as jagged.

So arrival sets a _target_ and the reveal rate is derived from the backlog instead. A burst makes the text catch up faster; it does not make the text jump. Shrinking the coalescing window does not fix this — it makes the lumps smaller and more frequent, at the cost of message rate on a daemon loop that already contends with terminal frames and per-message relay encryption.

## Invariants

- **The coalescer is leading + trailing.** The first delta after an idle window flushes synchronously; only the rest of the burst waits for the trailing timer. Reverting to trailing-only adds a full window to the first character of every turn. Same shape and the same reason as `TerminalOutputCoalescer`.
- **The leading flush adds a canonical row, and that is fine.** A burst's first chunk lands as its own timeline row. `mergeAssistantChunks` / `mergeReasoningChunks` in `timeline-projection.ts` join contiguous same-turn rows, and clients read the projected timeline, so history is unaffected. Tests that assert on raw rows have to account for the extra row; tests that assert on what a client sees do not.
- **The store holds the full text; only the rendered slice is paced.** Copy, selection, the chat outline, and scroll geometry all read the same string the user can see. Pacing the store instead would leave the bottom anchor chasing a content height that is ahead of the reveal.
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
- **First sight of a text is revealed whole.** Only growth is paced. This is what makes history hydration, timeline replay, a virtualized row remounting on scroll, and an already-finished message all render complete on first paint without a special case for each.
- **Leaving `phase: "streaming"` snaps the reveal.** A completed turn must never be left holding characters. `layoutStream` sets the phase, so anything outside the live head with an active turn is already complete.
- **Browser bottom-follow stays physically anchored.** Do not smooth `scrollTop`: it leaves the response tail below the viewport while the animation catches up. `strategy-web.tsx` anchors first, offsets the message timeline by the anchor correction, then eases that visual offset to zero. Apply the compensation to the timeline rows, not the live turn footer, so earlier messages rise while fork and elapsed stay put for the rest of the turn. Clip that rise to the timeline's layout box (`overflow: hidden` on an untransformed wrapper) so translated tokens cannot paint over the footer. Do not pad the layout to cover the footer: extra height re-enters stick/rise. Leave the footer after the clip so `ChatGrowthClip` can still push it down while the viewport is not yet scrolling. Paced reveal grows text inside an already-mounted live-head row, so that height change never invalidates `liveHead`. Stick and rise from the `ResizeObserver` callback, before paint. A later growth must start its rise before cancelling the previous one; `Animation.cancel()` drops the in-flight offset immediately, and a fast footer or first token would snap the remaining 10–20px.
- **Chat arrivals share one motion boundary.** Use `chat-entry-motion.tsx` for user-sent rows and new streaming thought/tool rows as they appear. Play on mount — waiting for IntersectionObserver left a sent row at opacity 0 behind the timeline clip until eligibility ended and snapped it in. Assistant text, permissions, and the turn footer wrapper do not fade as a row. Newly revealed stream words fade in on an opacity toggle keyed by token index, using `MOTION_STREAM_WORD_FADE_DURATION_MS` (slower than the burst window since each word fades independently and can't lag behind arriving text), so a longer line cannot restart earlier words. Copy, fork, and elapsed insides stagger on the shared arrive curve only when a live turn just completed; `turn-footer-entry-motion` is the wrapper and stays opaque. Durations come from `packages/app/src/styles/motion.ts`. Wrapped lines grow inside an already-mounted block, so `ChatGrowthClip` eases that block's height and clips the new line until it rises in. A quiet wrap uses the arrive window. An in-flight retarget or a lump bigger than one line uses the burst window so the clip stays on the stream instead of restarting 200ms on every token. The web timeline rise uses the burst window only for in-flight catch-up, so a sent message keeps the arrive window. Streaming Thinking and other plain-text tool-call details reuse that clip; a layout transition on the expanded badge would fight it. File-edit diffs and other non-plain details use the same clip while the call is running, and expandable badges ease both expansion and collapse smoothly so details do not pop or snap shut (details already open during streaming do not replay when execution settles). A loading tool-call summary sizes to its content immediately and fades the new suffix when counts grow; the shimmer sweep's duration is captured on first layout so extra words cannot restart it, but its travel span stays live so it always sweeps the label's current width. User-submitted rows animate on first appearance after history hydration, not only while the send is pending — a fast provider ack would otherwise remount the row at full opacity. Follow-up calls inside an expanded overview use the growth clip. They do not fade in.
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

Healthy numbers (2026-08, Expo web against a local dev daemon, real Claude Haiku agent, ~8.5s samples during active streaming). Setting `TEXT_REVEAL_HORIZON_MS` to 0 makes the reveal paint on arrival, which is how the baseline column was taken:

|                                  | paint on arrival | paced |
| -------------------------------- | ---------------- | ----- |
| frames that advanced the text    | 6%               | 87%   |
| chars-per-frame CV               | 4.11             | 1.86  |
| gap between visible updates, p50 | 317ms            | 17ms  |
| gap between visible updates, p95 | 383ms            | 17ms  |

Total characters painted is roughly the same either way — the reveal changes when they land, not how many arrive.

Measure the **total** length across every `assistant-message` element, not the last one. A turn emits many assistant messages, so the tail element keeps changing identity and its length is not monotonic; sampling only the tail reads those handovers as resets and reports almost no growth. `sampleStreamFrames` does this correctly.
