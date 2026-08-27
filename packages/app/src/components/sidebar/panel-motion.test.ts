import { describe, expect, it } from "vitest";
import {
  resolveSidebarPanelFrameStyle,
  resolveSidebarPanelInnerLock,
  resolveSidebarPanelWidthCause,
  resolveSidebarPanelWidthMotion,
  sidebarPanelOccupiesLayout,
} from "./panel-motion";

describe("sidebar panel width cause", () => {
  it("snaps the first paint, eases a later toggle, and snaps live resize", () => {
    expect(
      resolveSidebarPanelWidthCause({
        hasPainted: false,
        openChanged: true,
      }),
    ).toBe("hydrate");
    expect(
      resolveSidebarPanelWidthCause({
        hasPainted: true,
        openChanged: true,
      }),
    ).toBe("toggle");
    expect(
      resolveSidebarPanelWidthCause({
        hasPainted: true,
        openChanged: false,
      }),
    ).toBe("resize");
  });
});

describe("sidebar panel width motion", () => {
  it("snaps hydration and resize, and ignores a width that is already there", () => {
    expect(
      resolveSidebarPanelWidthMotion({
        open: true,
        openWidth: 320,
        currentWidth: 0,
        reducedMotion: false,
        cause: "hydrate",
      }),
    ).toEqual({ action: "snap", to: 320 });
    expect(
      resolveSidebarPanelWidthMotion({
        open: false,
        openWidth: 320,
        currentWidth: 320,
        reducedMotion: false,
        cause: "hydrate",
      }),
    ).toEqual({ action: "snap", to: 0 });
    expect(
      resolveSidebarPanelWidthMotion({
        open: true,
        openWidth: 280,
        currentWidth: 320,
        reducedMotion: false,
        cause: "resize",
      }),
    ).toEqual({ action: "snap", to: 280 });
    expect(
      resolveSidebarPanelWidthMotion({
        open: true,
        openWidth: 320,
        currentWidth: 320.2,
        reducedMotion: false,
        cause: "toggle",
      }),
    ).toEqual({ action: "ignore" });
  });

  it("eases a user toggle and snaps when motion is reduced", () => {
    expect(
      resolveSidebarPanelWidthMotion({
        open: true,
        openWidth: 320,
        currentWidth: 0,
        reducedMotion: false,
        cause: "toggle",
      }),
    ).toEqual({ action: "ease", from: 0, to: 320, curve: "arrive" });
    expect(
      resolveSidebarPanelWidthMotion({
        open: false,
        openWidth: 320,
        currentWidth: 320,
        reducedMotion: false,
        cause: "toggle",
      }),
    ).toEqual({ action: "ease", from: 320, to: 0, curve: "exit" });
    expect(
      resolveSidebarPanelWidthMotion({
        open: false,
        openWidth: 320,
        currentWidth: 320,
        reducedMotion: true,
        cause: "toggle",
      }),
    ).toEqual({ action: "snap", to: 0 });
  });
});

describe("sidebar panel inner lock", () => {
  it("locks to the open width while toggling so the clip does not reflow", () => {
    expect(
      resolveSidebarPanelInnerLock({
        cause: "toggle",
        open: true,
        openWidth: 320,
        currentWidth: 0,
      }),
    ).toEqual({ lock: true, width: 320 });
    expect(
      resolveSidebarPanelInnerLock({
        cause: "toggle",
        open: false,
        openWidth: 320,
        currentWidth: 280,
      }),
    ).toEqual({ lock: true, width: 280 });
  });

  it("follows the live width while hydrating or resizing", () => {
    expect(
      resolveSidebarPanelInnerLock({
        cause: "hydrate",
        open: true,
        openWidth: 320,
        currentWidth: 320,
      }),
    ).toEqual({ lock: false, width: 320 });
    expect(
      resolveSidebarPanelInnerLock({
        cause: "resize",
        open: true,
        openWidth: 240,
        currentWidth: 240,
      }),
    ).toEqual({ lock: false, width: 240 });
  });
});

describe("sidebar panel layout occupancy", () => {
  it("keeps chrome on the panel until a close finishes", () => {
    expect(sidebarPanelOccupiesLayout({ open: true, closing: false })).toBe(true);
    expect(sidebarPanelOccupiesLayout({ open: false, closing: true })).toBe(true);
    expect(sidebarPanelOccupiesLayout({ open: false, closing: false })).toBe(false);
  });
});

describe("sidebar panel frame style", () => {
  it("clips to the animated width so inner content can keep the open size", () => {
    expect(resolveSidebarPanelFrameStyle(320)).toEqual({
      width: 320,
      overflow: "hidden",
    });
    expect(resolveSidebarPanelFrameStyle(0)).toEqual({
      width: 0,
      overflow: "hidden",
    });
  });
});
