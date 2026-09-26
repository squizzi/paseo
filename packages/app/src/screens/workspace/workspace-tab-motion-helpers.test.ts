import { beforeEach, describe, expect, it } from "vitest";
import { MOTION_EXIT_DURATION_MS } from "@/styles/motion-tokens";
import {
  forgetTabMotionId,
  isNewTabMotionItem,
  rememberTabMotionId,
  resetTabMotionRegistryForTesting,
  resolveTabMotionFrameStyle,
  resolveTabMotionProgress,
  seedTabMotionIds,
  waitForTabCloseMotion,
} from "./workspace-tab-motion-helpers";

describe("seedTabMotionIds", () => {
  beforeEach(() => {
    resetTabMotionRegistryForTesting();
  });

  it("seeds initial tab IDs when not hydrated", () => {
    const seenIds = new Set<string>();
    seedTabMotionIds({
      seenIds,
      didHydrate: false,
      ids: ["tab-1", "tab-2"],
    });

    expect(seenIds.has("tab-1")).toBe(true);
    expect(seenIds.has("tab-2")).toBe(true);
  });

  it("seeds tab IDs into global registry", () => {
    const seenIds = new Set<string>();
    seedTabMotionIds({
      seenIds,
      didHydrate: false,
      ids: ["tab-1"],
    });

    // Even with a completely fresh local seenIds set, isNewTabMotionItem knows tab-1 was seen
    expect(
      isNewTabMotionItem({
        id: "tab-1",
        didHydrate: true,
        seenIds: new Set<string>(),
      }),
    ).toBe(false);
  });

  it("does not seed tabs when already hydrated so new tabs are recognized as new", () => {
    const seenIds = new Set<string>();
    // Initial hydration with tab-1
    seedTabMotionIds({ seenIds, didHydrate: false, ids: ["tab-1"] });
    expect(isNewTabMotionItem({ id: "tab-1", didHydrate: true, seenIds })).toBe(false);

    // Now hydrated: tab-2 arrives
    seedTabMotionIds({ seenIds, didHydrate: true, ids: ["tab-1", "tab-2"] });
    // tab-2 must NOT have been seeded
    expect(seenIds.has("tab-2")).toBe(false);
    expect(isNewTabMotionItem({ id: "tab-2", didHydrate: true, seenIds })).toBe(true);
  });
});

describe("isNewTabMotionItem", () => {
  beforeEach(() => {
    resetTabMotionRegistryForTesting();
  });

  it("returns false before hydration even for unknown tabs", () => {
    const seenIds = new Set<string>(["tab-1"]);
    expect(
      isNewTabMotionItem({
        id: "tab-2",
        didHydrate: false,
        seenIds,
      }),
    ).toBe(false);
  });

  it("returns false for tabs already seen during hydration", () => {
    const seenIds = new Set<string>(["tab-1", "tab-2"]);
    seedTabMotionIds({ seenIds, didHydrate: false, ids: ["tab-1", "tab-2"] });
    expect(
      isNewTabMotionItem({
        id: "tab-1",
        didHydrate: true,
        seenIds,
      }),
    ).toBe(false);
  });

  it("returns true for newly added tabs after hydration", () => {
    const seenIds = new Set<string>(["tab-1", "tab-2"]);
    seedTabMotionIds({ seenIds, didHydrate: false, ids: ["tab-1", "tab-2"] });
    expect(
      isNewTabMotionItem({
        id: "tab-new",
        didHydrate: true,
        seenIds,
      }),
    ).toBe(true);
  });

  it("returns false on remount / minimize-restore when screen returns with existing tabs", () => {
    // Initial mount: tab-1 and tab-2 are present and seeded
    seedTabMotionIds({ seenIds: new Set(), didHydrate: false, ids: ["tab-1", "tab-2"] });

    // Now simulate window minimized and restored: a fresh component instance mounts with empty local state
    const remountLocalSeenIds = new Set<string>();
    expect(
      isNewTabMotionItem({
        id: "tab-1",
        didHydrate: true,
        seenIds: remountLocalSeenIds,
      }),
    ).toBe(false);
    expect(
      isNewTabMotionItem({
        id: "tab-2",
        didHydrate: true,
        seenIds: remountLocalSeenIds,
      }),
    ).toBe(false);
  });

  it("allows newly opened tab after closing an old tab", () => {
    rememberTabMotionId("tab-singleton");
    expect(
      isNewTabMotionItem({
        id: "tab-singleton",
        didHydrate: true,
        seenIds: new Set(),
      }),
    ).toBe(false);

    forgetTabMotionId("tab-singleton");
    expect(
      isNewTabMotionItem({
        id: "tab-singleton",
        didHydrate: true,
        seenIds: new Set(),
      }),
    ).toBe(true);
  });
});

describe("resolveTabMotionProgress", () => {
  it("returns 0 when width is 0", () => {
    expect(resolveTabMotionProgress(0, 150)).toBe(0);
  });

  it("returns proportional progress between 0 and 1", () => {
    expect(resolveTabMotionProgress(75, 150)).toBe(0.5);
  });

  it("clamps negative width to 0", () => {
    expect(resolveTabMotionProgress(-20, 150)).toBe(0);
  });

  it("clamps overflow width to 1", () => {
    expect(resolveTabMotionProgress(200, 150)).toBe(1);
  });

  it("returns 1 if target width is 0 or negative", () => {
    expect(resolveTabMotionProgress(50, 0)).toBe(1);
    expect(resolveTabMotionProgress(50, -10)).toBe(1);
  });
});

describe("resolveTabMotionFrameStyle", () => {
  it("calculates frame style with hidden overflow while animating", () => {
    const style = resolveTabMotionFrameStyle({
      width: 75,
      targetWidth: 150,
      opacity: 0.5,
      marginHorizontal: 2,
      isAnimating: true,
    });

    expect(style).toEqual({
      width: 75,
      opacity: 0.5,
      marginHorizontal: 1,
      overflow: "hidden",
      flexShrink: 0,
    });
  });

  it("returns visible overflow and full margin when settled", () => {
    const style = resolveTabMotionFrameStyle({
      width: 150,
      targetWidth: 150,
      opacity: 1,
      marginHorizontal: 2,
      isAnimating: false,
    });

    expect(style).toEqual({
      width: 150,
      opacity: 1,
      marginHorizontal: 2,
      overflow: "visible",
      flexShrink: 0,
    });
  });

  it("returns zero margin when collapsed to width 0", () => {
    const style = resolveTabMotionFrameStyle({
      width: 0,
      targetWidth: 150,
      opacity: 0,
      marginHorizontal: 2,
      isAnimating: true,
    });

    expect(style).toEqual({
      width: 0,
      opacity: 0,
      marginHorizontal: 0,
      overflow: "hidden",
      flexShrink: 0,
    });
  });
});

describe("waitForTabCloseMotion", () => {
  it("resolves immediately when reducedMotion is true", async () => {
    const start = Date.now();
    await waitForTabCloseMotion(true);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("waits for exit duration when reducedMotion is false", async () => {
    const start = Date.now();
    await waitForTabCloseMotion(false);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(MOTION_EXIT_DURATION_MS - 20);
  });
});
