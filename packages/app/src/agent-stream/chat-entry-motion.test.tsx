/**
 * @vitest-environment jsdom
 */
import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/constants/platform", () => ({
  isWeb: true,
  isNative: false,
}));

vi.mock("react-native-reanimated", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");

  function flattenStyle(style: unknown): Record<string, unknown> {
    if (style == null) {
      return {};
    }
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.map(flattenStyle));
    }
    if (typeof style === "object") {
      return style as Record<string, unknown>;
    }
    return {};
  }

  const View = ReactModule.forwardRef(function MockAnimatedView(
    {
      children,
      style,
      testID,
    }: {
      children?: ReactNode;
      style?: unknown;
      testID?: string;
    },
    ref: React.Ref<HTMLDivElement>,
  ) {
    const opacity = flattenStyle(style).opacity;
    return ReactModule.createElement(
      "div",
      {
        "data-testid": testID,
        ref,
        style: { opacity: typeof opacity === "number" ? opacity : undefined },
      },
      children,
    );
  });

  return {
    default: { View },
    cancelAnimation: vi.fn(),
    Easing: {
      out: (easing: unknown) => easing,
      cubic: "cubic",
    },
    LinearTransition: {
      duration: () => ({ easing: () => undefined }),
    },
    ReduceMotion: { System: "system" },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (initial: number) => {
      const [, setVersion] = ReactModule.useState(0);
      const store = ReactModule.useRef<{ value: number } | null>(null);
      if (store.current === null) {
        let inner = initial;
        store.current = {
          get value() {
            return inner;
          },
          set value(next: number) {
            if (Object.is(inner, next)) {
              return;
            }
            inner = next;
            setVersion((version) => version + 1);
          },
        };
      }
      return store.current;
    },
    withTiming: vi.fn((value: unknown) => value),
  };
});

import { withTiming, type SharedValue } from "react-native-reanimated";
import {
  applyGrowthHeight,
  ChatEntryMotion,
  shouldAnimateStreamItemEntry,
} from "./chat-entry-motion";
import type { StreamLayoutItem } from "./layout";

interface ViewportIntersection {
  isIntersecting: boolean;
}

interface FakeObserver {
  callback: (entries: ViewportIntersection[]) => void;
  disconnect: ReturnType<typeof vi.fn>;
}

describe("ChatEntryMotion", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let observers: FakeObserver[] = [];

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      value: true,
      configurable: true,
    });
    observers = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class FakeIntersectionObserver {
        disconnect: ReturnType<typeof vi.fn>;
        constructor(callback: (entries: ViewportIntersection[]) => void) {
          this.disconnect = vi.fn();
          observers.push({ callback, disconnect: this.disconnect });
        }
        observe() {}
        unobserve() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
    observers = [];
    vi.unstubAllGlobals();
  });

  function renderEntry(animateOnMount: boolean) {
    act(() => {
      root?.render(
        <div data-testid="agent-chat-scroll">
          <ChatEntryMotion animateOnMount={animateOnMount} testID="stream-item">
            row
          </ChatEntryMotion>
        </div>,
      );
    });
  }

  function entryOpacity(): number {
    const entry = container?.querySelector('[data-testid="stream-item"]');
    if (!(entry instanceof HTMLElement)) {
      throw new Error("Expected chat entry host");
    }
    return Number.parseFloat(entry.style.opacity);
  }

  it("snaps a completed off-screen row to rest instead of leaving it transparent", () => {
    renderEntry(true);
    expect(observers).toHaveLength(1);
    expect(entryOpacity()).toBe(0);

    renderEntry(false);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
    expect(entryOpacity()).toBe(1);
  });

  it("plays entry motion once the off-screen row intersects the chat viewport", () => {
    renderEntry(true);
    expect(entryOpacity()).toBe(0);

    const observer = observers[0];
    if (!observer) {
      throw new Error("Expected a chat viewport observer");
    }
    act(() => {
      observer.callback([{ isIntersecting: true }]);
    });
    expect(entryOpacity()).toBe(1);
  });
});

describe("applyGrowthHeight", () => {
  function createHeight(initial: number): {
    writes: number[];
    height: SharedValue<number>;
  } {
    const writes: number[] = [];
    let inner = initial;
    const height: SharedValue<number> = {
      get value() {
        return inner;
      },
      set value(next: number) {
        writes.push(next);
        inner = next;
      },
      get: () => inner,
      set: (value) => {
        inner = typeof value === "function" ? value(inner) : value;
        writes.push(inner);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      modify: () => undefined,
    };
    return { writes, height };
  }

  it("retargets continued growth instead of snapping back to the last target", () => {
    const { writes, height } = createHeight(-1);
    const contentHeightRef = { current: null as number | null };

    applyGrowthHeight(height, contentHeightRef, 100);
    expect(writes).toEqual([100]);

    writes.length = 0;
    applyGrowthHeight(height, contentHeightRef, 118);
    expect(writes).toEqual([118]);
  });

  it("eases the first measurement from zero when the clip is revealing details", () => {
    const { writes, height } = createHeight(-1);
    const contentHeightRef = { current: null as number | null };
    vi.mocked(withTiming).mockClear();

    applyGrowthHeight(height, contentHeightRef, 80, { easeInitial: true });

    expect(writes).toEqual([0, 80]);
    expect(vi.mocked(withTiming)).toHaveBeenCalledWith(
      80,
      expect.objectContaining({ duration: 160 }),
    );
  });
});

describe("shouldAnimateStreamItemEntry", () => {
  function makeLayoutItem(
    item: StreamLayoutItem["item"],
    phase: StreamLayoutItem["phase"] = "streaming",
  ): StreamLayoutItem {
    return {
      item,
      phase,
      aboveItem: null,
      belowItem: null,
      gapBelow: 8,
      assistantSpacing: "default",
      completedFooter: null,
      toolSequence: "none",
      isFirstInUserGroup: false,
      isLastInUserGroup: false,
      isLastInToolSequence: false,
      frameOrder: "content-then-footer",
    };
  }

  it("animates streaming thought arrivals when they initially show up", () => {
    const item = makeLayoutItem(
      {
        kind: "thought",
        id: "thought-1",
        text: "Thinking...",
        timestamp: new Date(),
        status: "loading",
      },
      "streaming",
    );
    expect(shouldAnimateStreamItemEntry(item, new Set(), new Set())).toBe(true);
  });

  it("animates streaming tool call arrivals when they initially show up", () => {
    const item = makeLayoutItem(
      {
        kind: "tool_call",
        id: "tool-1",
        timestamp: new Date(),
        payload: {
          source: "orchestrator",
          data: {
            toolCallId: "call-1",
            toolName: "bash",
            arguments: {},
            status: "executing",
          },
        },
      },
      "streaming",
    );
    expect(shouldAnimateStreamItemEntry(item, new Set(), new Set())).toBe(true);
  });

  it("does not animate thought items in completed history phase", () => {
    const item = makeLayoutItem(
      {
        kind: "thought",
        id: "thought-1",
        text: "Thought",
        timestamp: new Date(),
        status: "ready",
      },
      "complete",
    );
    expect(shouldAnimateStreamItemEntry(item, new Set(), new Set())).toBe(false);
  });

  it("does not animate assistant message row as a unit", () => {
    const item = makeLayoutItem(
      {
        kind: "assistant_message",
        id: "asst-1",
        text: "Hello",
        timestamp: new Date(),
      },
      "streaming",
    );
    expect(shouldAnimateStreamItemEntry(item, new Set(), new Set())).toBe(false);
  });

  it("animates pending user message submissions", () => {
    const item = makeLayoutItem(
      {
        kind: "user_message",
        id: "user-1",
        clientMessageId: "client-msg-1",
        text: "Hi",
        timestamp: new Date(),
      },
      "streaming",
    );
    expect(shouldAnimateStreamItemEntry(item, new Set(["client-msg-1"]), null)).toBe(true);
  });
});
