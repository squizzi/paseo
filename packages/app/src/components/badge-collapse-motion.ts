export const BADGE_COLLAPSE_DURATION_MS = 160;
export const BADGE_COLLAPSE_AUTO_HEIGHT = -1;

export type BadgeCollapseClipResize = { action: "ignore" } | { action: "ease"; to: number };

export function resolveBadgeCollapseClipResize(input: {
  expanded: boolean;
  settledOpen: boolean;
  nextHeight: number;
  targetHeight: number;
}): BadgeCollapseClipResize {
  if (!input.expanded || input.settledOpen || input.nextHeight <= 0) {
    return { action: "ignore" };
  }
  if (Math.abs(input.nextHeight - input.targetHeight) <= 0.5) {
    return { action: "ignore" };
  }
  return { action: "ease", to: input.nextHeight };
}

export interface BadgeCollapseClipFrameStyle {
  height?: number;
  overflow: "hidden";
}

export function resolveBadgeCollapseClipFrameStyle(height: number): BadgeCollapseClipFrameStyle {
  "worklet";
  if (height >= 0) {
    return {
      height,
      overflow: "hidden",
    };
  }
  return {
    overflow: "hidden",
  };
}
