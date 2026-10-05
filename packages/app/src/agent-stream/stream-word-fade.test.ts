import { describe, expect, it } from "vitest";
import {
  nextStreamFadeState,
  settleStreamFadeChunks,
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
    expect(nextStreamFadeState(empty, "Ran 1 command", true, 0)).toEqual({
      committed: "",
      chunks: [{ start: 0, text: "Ran 1 command", startedAtMs: 0 }],
    });
  });

  it("keeps an in-flight chunk frozen when a later arrival lands", () => {
    const fading = nextStreamFadeState(empty, "Hello", true, 0);
    expect(nextStreamFadeState(fading, "Hello world", true, 50)).toEqual({
      committed: "",
      chunks: [
        { start: 0, text: "Hello", startedAtMs: 0 },
        { start: 5, text: " world", startedAtMs: 50 },
      ],
    });
  });

  it("does not promote a finished suffix at the moment a later arrival lands", () => {
    const first = nextStreamFadeState(empty, "This line already played", true, 0);
    const second = nextStreamFadeState(
      first,
      "This line already played through the animation",
      true,
      50,
    );
    expect(second.committed).toBe("");
    expect(second.chunks).toEqual([
      { start: 0, text: "This line already played", startedAtMs: 0 },
      { start: 24, text: " through the animation", startedAtMs: 50 },
    ]);
  });

  it("snaps to the live text when fading is disabled", () => {
    const fading = nextStreamFadeState(empty, "Hel", true, 0);
    expect(nextStreamFadeState(fading, "Hello", false, 50)).toEqual({
      committed: "Hello",
      chunks: [],
    });
  });

  it("snaps to the live text when upstream rewrites earlier content", () => {
    const fading = nextStreamFadeState(empty, "Hello world more text", true, 0);
    expect(nextStreamFadeState(fading, "Hello world", true, 50)).toEqual({
      committed: "Hello world",
      chunks: [],
    });
  });

  it("returns the same state when the live text did not change", () => {
    const fading = nextStreamFadeState(empty, "Hello", true, 0);
    expect(nextStreamFadeState(fading, "Hello", true, 50)).toBe(fading);
  });
});

describe("settleStreamFadeChunks", () => {
  it("promotes a finished prefix so a later remount cannot replay its fade", () => {
    const first = nextStreamFadeState(empty, "This line already played", true, 0);
    const grown = nextStreamFadeState(first, "This line already played\nand a new line", true, 50);
    expect(settleStreamFadeChunks(grown, 400, 400)).toEqual({
      committed: "This line already played",
      chunks: [{ start: 24, text: "\nand a new line", startedAtMs: 50 }],
    });
  });

  it("leaves in-flight chunks fading", () => {
    const fading = nextStreamFadeState(empty, "Hello", true, 0);
    expect(settleStreamFadeChunks(fading, 399, 400)).toBe(fading);
  });

  it("promotes every chunk whose envelope has elapsed", () => {
    const first = nextStreamFadeState(empty, "One", true, 0);
    const grown = nextStreamFadeState(first, "One two", true, 50);
    expect(settleStreamFadeChunks(grown, 450, 400)).toEqual({
      committed: "One two",
      chunks: [],
    });
  });

  it("returns the same state when there is nothing to settle", () => {
    expect(settleStreamFadeChunks(empty, 1000, 400)).toBe(empty);
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
          { start: 5, text: " world", startedAtMs: 0 },
          { start: 11, text: " more", startedAtMs: 50 },
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
          { start: 5, text: " world", startedAtMs: 0 },
          { start: 11, text: " more", startedAtMs: 50 },
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
