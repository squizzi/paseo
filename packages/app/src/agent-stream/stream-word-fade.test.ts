import { describe, expect, it } from "vitest";
import {
  nextStreamFadeState,
  splitFadingText,
  STREAM_TOK_KEYFRAME_CSS,
  takeMarkdownTextSourceStart,
  waitForStreamTokAnimations,
  type StreamFadeState,
  type StreamTokAnimation,
} from "./stream-word-fade";

const empty: StreamFadeState = { committed: "", chunks: [] };

describe("nextStreamFadeState", () => {
  it("arrives the first dump as one frozen chunk", () => {
    expect(nextStreamFadeState(empty, "Ran 1 command", true)).toEqual({
      committed: "",
      chunks: [{ start: 0, text: "Ran 1 command" }],
    });
  });

  it("keeps an in-flight chunk frozen when a later arrival lands", () => {
    const fading = nextStreamFadeState(empty, "Hello", true);
    expect(nextStreamFadeState(fading, "Hello world", true)).toEqual({
      committed: "",
      chunks: [
        { start: 0, text: "Hello" },
        { start: 5, text: " world" },
      ],
    });
  });

  it("does not promote a finished suffix while the tail is still growing", () => {
    const first = nextStreamFadeState(empty, "This line already played", true);
    const second = nextStreamFadeState(
      first,
      "This line already played through the animation",
      true,
    );
    expect(second.committed).toBe("");
    expect(second.chunks).toEqual([
      { start: 0, text: "This line already played" },
      { start: 24, text: " through the animation" },
    ]);
  });

  it("snaps to the live text when fading is disabled", () => {
    const fading = nextStreamFadeState(empty, "Hel", true);
    expect(nextStreamFadeState(fading, "Hello", false)).toEqual({
      committed: "Hello",
      chunks: [],
    });
  });

  it("snaps to the live text when upstream rewrites earlier content", () => {
    const fading = nextStreamFadeState(empty, "Hello world more text", true);
    expect(nextStreamFadeState(fading, "Hello world", true)).toEqual({
      committed: "Hello world",
      chunks: [],
    });
  });

  it("returns the same state when the live text did not change", () => {
    const fading = nextStreamFadeState(empty, "Hello", true);
    expect(nextStreamFadeState(fading, "Hello", true)).toBe(fading);
  });
});

describe("splitFadingText", () => {
  it("keeps committed prefix plain and fades each later arrival separately", () => {
    expect(
      splitFadingText({
        content: "Hello world more",
        sourceStart: 0,
        committedLength: 5,
        chunks: [
          { start: 5, text: " world" },
          { start: 11, text: " more" },
        ],
      }),
    ).toEqual([
      { start: 0, text: "Hello", fade: false },
      { start: 5, text: " world", fade: true },
      { start: 11, text: " more", fade: true },
    ]);
  });

  it("fades only the overlap when a markdown leaf is a slice of the source", () => {
    expect(
      splitFadingText({
        content: "world more",
        sourceStart: 6,
        committedLength: 5,
        chunks: [
          { start: 5, text: " world" },
          { start: 11, text: " more" },
        ],
      }),
    ).toEqual([
      { start: 6, text: "world", fade: true },
      { start: 11, text: " more", fade: true },
    ]);
  });

  it("leaves copy unmarked when nothing is fading", () => {
    expect(
      splitFadingText({
        content: "Hello world",
        sourceStart: 0,
        committedLength: 11,
        chunks: [],
      }),
    ).toEqual([{ start: 0, text: "Hello world", fade: false }]);
  });
});

describe("takeMarkdownTextSourceStart", () => {
  it("walks duplicate leaves in source order so a later line is not mapped to the first", () => {
    const cursor = { current: 0 };
    const source = "the start\nthe end";
    expect(takeMarkdownTextSourceStart({ source, cursor, content: "the" })).toBe(0);
    expect(takeMarkdownTextSourceStart({ source, cursor, content: "the" })).toBe(10);
  });
});

describe("stream tok stylesheet", () => {
  it("inherits line-height and fades opacity without a filter", () => {
    expect(STREAM_TOK_KEYFRAME_CSS).toContain("line-height: inherit");
    expect(STREAM_TOK_KEYFRAME_CSS).toContain("ease-out backwards");
    expect(STREAM_TOK_KEYFRAME_CSS).toContain("from { opacity: 0; }");
    expect(STREAM_TOK_KEYFRAME_CSS).not.toContain("filter:");
    expect(STREAM_TOK_KEYFRAME_CSS).not.toContain("ease-out both");
  });
});

describe("waitForStreamTokAnimations", () => {
  it("waits for in-flight fades to finish", async () => {
    let resolveRunning: () => void = () => {};
    const running: StreamTokAnimation = {
      finished: new Promise<void>((resolve) => {
        resolveRunning = resolve;
      }),
    };
    const settled = waitForStreamTokAnimations({
      getAnimations() {
        return [running];
      },
    });
    resolveRunning();
    await settled;
  });

  it("resolves immediately when nothing is animating", async () => {
    await waitForStreamTokAnimations({
      getAnimations() {
        return [];
      },
    });
  });

  it("still settles when an in-flight fade is cancelled", async () => {
    let rejectRunning: () => void = () => {};
    const running: StreamTokAnimation = {
      finished: new Promise<void>((_resolve, reject) => {
        rejectRunning = reject;
      }),
    };
    const settled = waitForStreamTokAnimations({
      getAnimations() {
        return [running];
      },
    });
    rejectRunning();
    await settled;
  });
});
