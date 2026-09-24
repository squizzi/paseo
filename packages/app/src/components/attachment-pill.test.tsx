import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentFrame, AttachmentLabel } from "./attachment-pill";

const { theme } = vi.hoisted(() => ({
  theme: {
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
    borderWidth: { 1: 1 },
    borderRadius: { md: 6, lg: 8 },
    fontSize: { sm: 13, base: 15 },
    fontWeight: { normal: "400" },
    colors: {
      surface1: "#111",
      surface2: "#222",
      foreground: "#fff",
      foregroundMuted: "#aaa",
      border: "#555",
      borderAccent: "#444",
    },
  },
}));

vi.mock("react-native", () => ({
  View: ({ children, testID }: React.PropsWithChildren<{ testID?: string }>) =>
    React.createElement("div", { "data-testid": testID }, children),
  Text: ({ children }: React.PropsWithChildren) => React.createElement("span", null, children),
  Pressable: ({
    children,
    testID,
    onPress,
    accessibilityLabel,
    accessibilityState,
  }: React.PropsWithChildren<{
    testID?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityState?: { expanded?: boolean };
  }>) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        onClick: onPress,
        "aria-label": accessibilityLabel,
        "aria-expanded": accessibilityState?.expanded,
      },
      children,
    ),
  Image: () => null,
}));

vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: unknown) => (typeof factory === "function" ? factory(theme) : factory),
  },
  withUnistyles:
    (Component: React.ComponentType<Record<string, unknown>>) => (props: Record<string, unknown>) =>
      React.createElement(Component, props),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "message.attachments.showPrompt": "Show what this sends to the agent",
        "message.attachments.hidePrompt": "Hide what this sends to the agent",
      })[key] ?? key,
  }),
}));

vi.mock("@/constants/platform", () => ({
  isWeb: true,
  isNative: false,
}));

vi.mock("@/constants/layout", () => ({
  useIsCompactFormFactor: () => false,
}));

vi.mock("@/components/tool-call-details", () => ({
  ToolCallDetailsContent: ({ detail }: { detail: { text?: string } }) =>
    React.createElement("div", { "data-testid": "tool-call-details" }, detail.text),
}));

vi.mock("@/attachments/use-attachment-preview-url", () => ({
  useAttachmentPreviewUrl: () => null,
}));

vi.mock("lucide-react-native", () => ({
  ChevronRight: () => React.createElement("span", { "data-testid": "chevron-right" }),
  X: () => React.createElement("span", { "data-testid": "close-icon" }),
}));

describe("expandable attachment pills", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeEach(() => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
    vi.stubGlobal("Node", dom.window.Node);
    vi.stubGlobal("navigator", dom.window.navigator);

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
    container = null;
    vi.unstubAllGlobals();
  });

  function renderFrame(node: React.ReactElement): HTMLElement {
    act(() => {
      root?.render(node);
    });
    if (!container) {
      throw new Error("expected a mount container");
    }
    return container;
  }

  it("hides the agent prompt until the dropdown is opened", () => {
    const mounted = renderFrame(
      <AttachmentFrame details="Workspace file: src/app.ts">
        <AttachmentLabel title="app.ts" subtitle="TypeScript" />
      </AttachmentFrame>,
    );

    expect(mounted.textContent).toContain("app.ts");
    expect(mounted.textContent).not.toContain("Workspace file: src/app.ts");

    const toggle = mounted.querySelector('[data-testid="attachment-expand-toggle"]');
    if (!(toggle instanceof HTMLElement)) {
      throw new Error("expected an expand toggle");
    }
    act(() => {
      toggle.click();
    });

    const details = mounted.querySelector('[data-testid="attachment-prompt-details"]');
    expect(details?.textContent).toBe("Workspace file: src/app.ts");
  });

  it("does not show a dropdown when there is no prompt to preview", () => {
    const mounted = renderFrame(
      <AttachmentFrame>
        <AttachmentLabel title="app.ts" subtitle="TypeScript" />
      </AttachmentFrame>,
    );

    expect(mounted.querySelector('[data-testid="attachment-expand-toggle"]')).toBeNull();
    expect(mounted.querySelector('[data-testid="attachment-prompt-details"]')).toBeNull();
  });
});
