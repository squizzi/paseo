export type SidebarPanelWidthCause = "hydrate" | "toggle" | "resize";

export type SidebarPanelWidthMotion =
  | { action: "ignore" }
  | { action: "snap"; to: number }
  | { action: "ease"; from: number; to: number; curve: "arrive" | "exit" };

export interface SidebarPanelFrameStyle {
  width: number;
  overflow: "hidden";
}

export interface SidebarPanelInnerLock {
  lock: boolean;
  width: number;
}

/**
 * Open/close eases. First paint and live resize snap. Inner content keeps the
 * open width during a toggle so the clip does not reflow labels.
 */
export function resolveSidebarPanelWidthCause(input: {
  hasPainted: boolean;
  openChanged: boolean;
}): SidebarPanelWidthCause {
  if (!input.hasPainted) {
    return "hydrate";
  }
  if (input.openChanged) {
    return "toggle";
  }
  return "resize";
}

export function resolveSidebarPanelWidthMotion(input: {
  open: boolean;
  openWidth: number;
  currentWidth: number;
  reducedMotion: boolean;
  cause: SidebarPanelWidthCause;
}): SidebarPanelWidthMotion {
  const to = input.open ? input.openWidth : 0;
  if (Math.abs(input.currentWidth - to) <= 0.5) {
    return { action: "ignore" };
  }
  if (input.reducedMotion || input.cause === "hydrate" || input.cause === "resize") {
    return { action: "snap", to };
  }
  return {
    action: "ease",
    from: input.currentWidth,
    to,
    curve: input.open ? "arrive" : "exit",
  };
}

export function resolveSidebarPanelInnerLock(input: {
  cause: SidebarPanelWidthCause;
  open: boolean;
  openWidth: number;
  currentWidth: number;
}): SidebarPanelInnerLock {
  if (input.cause === "toggle") {
    return {
      lock: true,
      width: input.open ? input.openWidth : input.currentWidth,
    };
  }
  return { lock: false, width: input.openWidth };
}

export function sidebarPanelOccupiesLayout(input: { open: boolean; closing: boolean }): boolean {
  return input.open || input.closing;
}

export function resolveSidebarPanelFrameStyle(width: number): SidebarPanelFrameStyle {
  "worklet";
  return {
    width,
    overflow: "hidden",
  };
}
