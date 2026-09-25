export const BADGE_COLLAPSE_AUTO_HEIGHT = -1;

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
