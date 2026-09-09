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
  });

  it("keeps the latest streaming output in view until the reader scrolls up", () => {
    const scrollToEnd = vi.fn();
    let api: ReturnType<typeof useFollowOutputScroll> | undefined;

    function Probe({ enabled }: { enabled: boolean }) {
      api = useFollowOutputScroll(enabled);
      if (api.scrollRef.current?.scrollToEnd !== scrollToEnd) {
        const scrollable: Pick<ScrollView, "scrollToEnd"> = { scrollToEnd };
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
});
