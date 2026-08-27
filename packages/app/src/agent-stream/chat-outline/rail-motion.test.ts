// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_ENTRY_CSS, CHAT_ENTRY_DURATION_MS } from "@/styles/motion-tokens";
import {
  CHAT_OUTLINE_RAIL_WIDTH,
  resolveChatOutlineRailRevealStyle,
  useChatOutlineRailReveal,
} from "./rail-motion";

describe("chat outline rail reveal style", () => {
  it("starts off-screen to the left on the chat-entry window so the slide is visible", () => {
    expect(
      resolveChatOutlineRailRevealStyle({
        revealed: false,
        mounted: true,
        reducedMotion: false,
      }),
    ).toEqual({
      opacity: 0,
      transform: [{ translateX: -CHAT_OUTLINE_RAIL_WIDTH }],
      visibility: "visible",
      transition: `opacity ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}, transform ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}`,
    });
  });

  it("rests in place once revealed", () => {
    expect(
      resolveChatOutlineRailRevealStyle({
        revealed: true,
        mounted: true,
        reducedMotion: false,
      }),
    ).toEqual({
      opacity: 1,
      transform: [{ translateX: 0 }],
      visibility: "visible",
      transition: `opacity ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}, transform ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}`,
    });
  });

  it("keeps the settled rail off-screen and not visible", () => {
    expect(
      resolveChatOutlineRailRevealStyle({
        revealed: false,
        mounted: false,
        reducedMotion: false,
      }),
    ).toEqual({
      opacity: 0,
      transform: [{ translateX: -CHAT_OUTLINE_RAIL_WIDTH }],
      visibility: "hidden",
      transition: `opacity ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}, transform ${CHAT_ENTRY_DURATION_MS}ms ${CHAT_ENTRY_CSS}`,
    });
  });

  it("skips the transition when motion is reduced", () => {
    expect(
      resolveChatOutlineRailRevealStyle({
        revealed: false,
        mounted: true,
        reducedMotion: true,
      }),
    ).toEqual({
      opacity: 0,
      transform: [{ translateX: -CHAT_OUTLINE_RAIL_WIDTH }],
      visibility: "visible",
      transition: "none",
    });
  });
});

describe("useChatOutlineRailReveal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals after the panel becomes wide enough", () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useChatOutlineRailReveal(visible, false),
      { initialProps: { visible: false } },
    );

    expect(result.current).toEqual({ mounted: false, revealed: false });

    rerender({ visible: true });

    expect(result.current).toEqual({ mounted: true, revealed: true });
  });

  it("keeps the rail visible through the slide-out, then hides it", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useChatOutlineRailReveal(visible, false),
      { initialProps: { visible: true } },
    );

    rerender({ visible: false });

    expect(result.current).toEqual({ mounted: true, revealed: false });

    act(() => {
      vi.advanceTimersByTime(CHAT_ENTRY_DURATION_MS - 1);
    });
    expect(result.current).toEqual({ mounted: true, revealed: false });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ mounted: false, revealed: false });
  });

  it("hides immediately when motion is reduced", () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useChatOutlineRailReveal(visible, true),
      { initialProps: { visible: true } },
    );

    expect(result.current).toEqual({ mounted: true, revealed: true });

    rerender({ visible: false });

    expect(result.current).toEqual({ mounted: false, revealed: false });
  });
});
