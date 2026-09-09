/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeScrollEvent, ScrollView } from "react-native";
import {
  createFollowOutputScrollState,
  reduceFollowOutputUserScroll,
  resetFollowOutputScrollPersistence,
  resolveFollowOutputContentSizeAction,
  shouldIgnoreFollowOutputScrollReset,
  shouldStickFollowOutputToBottom,
  useFollowOutputScroll,
} from "./follow-output-scroll";

function metrics(
  offsetY: number,
  contentHeight = 800,
  viewportHeight = 400,
): {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
} {
  return { offsetY, contentHeight, viewportHeight };
}

function scrollEvent(offsetY: number, contentHeight = 800, viewportHeight = 400) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: offsetY },
      contentSize: { width: 300, height: contentHeight },
      layoutMeasurement: { width: 300, height: viewportHeight },
    } satisfies Pick<NativeScrollEvent, "contentOffset" | "contentSize" | "layoutMeasurement">,
  };
}

describe("follow-output scroll", () => {
  it("sticks to new output while the reader stays at the bottom", () => {
    const state = createFollowOutputScrollState(400);
    expect(shouldStickFollowOutputToBottom({ enabled: true, following: state.following })).toBe(
      true,
    );
  });

  it("stops pushing the reader down after they scroll up through streaming output", () => {
    const state = reduceFollowOutputUserScroll(createFollowOutputScrollState(400), metrics(280));
    expect(state.following).toBe(false);
    expect(shouldStickFollowOutputToBottom({ enabled: true, following: state.following })).toBe(
      false,
    );
  });

  it("does not treat a 1px jitter as the reader leaving the bottom", () => {
    const state = reduceFollowOutputUserScroll(createFollowOutputScrollState(400), metrics(399));
    expect(state.following).toBe(true);
  });

  it("reattaches when the reader scrolls back to the bottom", () => {
    const detached = reduceFollowOutputUserScroll(createFollowOutputScrollState(400), metrics(200));
    const reattached = reduceFollowOutputUserScroll(detached, metrics(400));
    expect(reattached.following).toBe(true);
    expect(
      shouldStickFollowOutputToBottom({ enabled: true, following: reattached.following }),
    ).toBe(true);
  });

  it("does not reattach from a downward scroll that is still above the bottom", () => {
    const detached = reduceFollowOutputUserScroll(createFollowOutputScrollState(400), metrics(100));
    const stillDetached = reduceFollowOutputUserScroll(detached, metrics(200));
    expect(stillDetached.following).toBe(false);
  });

  it("does not stick after the stream finishes", () => {
    expect(shouldStickFollowOutputToBottom({ enabled: false, following: true })).toBe(false);
  });

  it("puts a glued finished panel back at the end after a relayout reset", () => {
    expect(
      resolveFollowOutputContentSizeAction({
        enabled: false,
        following: true,
        restoreOffsetY: null,
        restoreToEnd: true,
      }),
    ).toBe("stick-end");
    expect(
      shouldIgnoreFollowOutputScrollReset({
        restoreOffsetY: null,
        restoreToEnd: true,
        offsetY: 0,
      }),
    ).toBe(true);
  });

  it("keeps a scrolled-up finished panel at its last offset", () => {
    expect(
      resolveFollowOutputContentSizeAction({
        enabled: false,
        following: false,
        restoreOffsetY: 280,
        restoreToEnd: false,
      }),
    ).toBe("restore");
    expect(
      shouldIgnoreFollowOutputScrollReset({
        restoreOffsetY: 280,
        restoreToEnd: false,
        offsetY: 0,
      }),
    ).toBe(true);
    expect(
      shouldIgnoreFollowOutputScrollReset({
        restoreOffsetY: 280,
        restoreToEnd: false,
        offsetY: 280,
      }),
    ).toBe(false);
  });

  it("ignores an unexpected 0 reset when a glued overflowing panel was already at the bottom", () => {
    expect(
      shouldIgnoreFollowOutputScrollReset({
        restoreOffsetY: null,
        restoreToEnd: false,
        offsetY: 0,
        following: true,
        hasOverflow: true,
      }),
    ).toBe(true);
    expect(
      shouldIgnoreFollowOutputScrollReset({
        restoreOffsetY: null,
        restoreToEnd: false,
        offsetY: 0,
        following: false,
        hasOverflow: true,
      }),
    ).toBe(false);
  });
});

describe("useFollowOutputScroll", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    resetFollowOutputScrollPersistence();
  });

  it("keeps the latest streaming output in view until the reader scrolls up", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled);
      if (api.scrollRef.current?.scrollToEnd !== scrollToEnd) {
        const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
        Object.assign(api.scrollRef, { current: scrollable });
      }
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    if (!api) {
      throw new Error("Expected follow-output scroll hook");
    }
    const follow = api;

    act(() => {
      follow.onScroll(scrollEvent(400));
      follow.onContentSizeChange();
    });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });

    scrollToEnd.mockClear();
    act(() => {
      follow.onScroll(scrollEvent(280));
      follow.onContentSizeChange();
    });
    expect(scrollToEnd).not.toHaveBeenCalled();

    act(() => {
      follow.onScroll(scrollEvent(400));
      follow.onContentSizeChange();
    });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("leaves the scroll position alone when streaming ends", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled);
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    if (!api) {
      throw new Error("Expected follow-output scroll hook");
    }
    const follow = api;

    act(() => {
      follow.onScroll(scrollEvent(400));
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();

    act(() => {
      root.render(<Probe enabled={false} />);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });

    scrollToEnd.mockClear();
    act(() => {
      follow.onScroll(scrollEvent(0));
    });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(scrollTo).not.toHaveBeenCalled();

    scrollToEnd.mockClear();
    act(() => {
      follow.onScroll(scrollEvent(400));
      follow.onContentSizeChange();
    });
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it("does not jump a scrolled-up reader to the start when streaming ends", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled);
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    if (!api) {
      throw new Error("Expected follow-output scroll hook");
    }
    const follow = api;

    act(() => {
      follow.onScroll(scrollEvent(400));
      follow.onScroll(scrollEvent(280));
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();

    act(() => {
      root.render(<Probe enabled={false} />);
    });
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ y: 280, animated: false });
  });

  it("restores the last offset after the finished panel remounts as history", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled, "thought-1");
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    if (!api) {
      throw new Error("Expected follow-output scroll hook");
    }

    act(() => {
      api?.onScroll(scrollEvent(400));
    });

    act(() => {
      root.render(null);
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();
    api = undefined;

    act(() => {
      root.render(<Probe enabled={false} />);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });

    if (!api) {
      throw new Error("Expected remounted follow-output scroll hook");
    }
    scrollToEnd.mockClear();
    act(() => {
      api?.onScroll(scrollEvent(0));
    });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("puts a glued panel back at the end after remount even if no scroll events fired", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled, "thought-2");
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    act(() => {
      api?.onContentSizeChange();
    });

    act(() => {
      root.render(null);
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();

    act(() => {
      root.render(<Probe enabled={false} />);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("restores the glued panel when transitioning to history in the same render pass", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled, id }: { enabled: boolean; id: string }) {
      api = useFollowOutputScroll(enabled, id);
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled id="thought-same-pass" key="live" />);
    });
    act(() => {
      api?.onScroll(scrollEvent(400));
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();

    // Transition directly without intermediate null render
    act(() => {
      root.render(<Probe enabled={false} id="thought-same-pass" key="history" />);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("restores a scrolled-up offset when transitioning to history in the same render pass", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled, id }: { enabled: boolean; id: string }) {
      api = useFollowOutputScroll(enabled, id);
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled id="thought-scroll-pass" key="live" />);
    });
    act(() => {
      api?.onScroll(scrollEvent(400));
      api?.onScroll(scrollEvent(220));
    });
    scrollToEnd.mockClear();
    scrollTo.mockClear();

    // Transition directly without intermediate null render
    act(() => {
      root.render(<Probe enabled={false} id="thought-scroll-pass" key="history" />);
    });
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ y: 220, animated: false });
  });

  it("ignores an unexpected 0 scroll reset on a glued overflowing panel after streaming ends", () => {
    const scrollToEnd = vi.fn();
    const scrollTo = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled, "thought-reset-test");
      const scrollable: Pick<ScrollView, "scrollToEnd" | "scrollTo"> = { scrollToEnd, scrollTo };
      Object.assign(api.scrollRef, { current: scrollable });
      return null;
    }

    act(() => {
      root.render(<Probe enabled />);
    });
    act(() => {
      api?.onScroll(scrollEvent(400, 800, 400));
    });

    act(() => {
      root.render(<Probe enabled={false} />);
    });
    // Restore on streaming end
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    scrollToEnd.mockClear();

    // Now a scroll event fires at offset 400
    act(() => {
      api?.onScroll(scrollEvent(400, 800, 400));
    });

    // Then an artificial DOM reset event fires at offset 0 while content is 800px > 400px
    act(() => {
      api?.onScroll(scrollEvent(0, 800, 400));
    });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
