export type CollapseClipResize = { action: "ignore" } | { action: "ease"; to: number };

/**
 * Shared expand policy for height and width clips: keep easing toward the latest
 * measured size, never snap back, and ignore layouts once settled or collapsing.
 */
export function resolveCollapseClipResize(input: {
  expanded: boolean;
  settledOpen: boolean;
  nextSize: number;
  targetSize: number;
}): CollapseClipResize {
  if (!input.expanded || input.settledOpen || input.nextSize <= 0) {
    return { action: "ignore" };
  }
  if (Math.abs(input.nextSize - input.targetSize) <= 0.5) {
    return { action: "ignore" };
  }
  return { action: "ease", to: input.nextSize };
}
