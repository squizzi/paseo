import { MOTION_CLIP_AUTO, MOTION_EXIT_DURATION_MS } from "@/styles/motion-tokens";

const globalSeenTabIds = new Set<string>();

export function rememberTabMotionId(id: string): void {
  globalSeenTabIds.add(id);
}

export function forgetTabMotionId(id: string): void {
  globalSeenTabIds.delete(id);
}

export function isTabMotionIdKnown(id: string): boolean {
  return globalSeenTabIds.has(id);
}

export function seedTabMotionIds(input: {
  seenIds: Set<string>;
  didHydrate: boolean;
  ids: readonly string[];
}): void {
  if (input.didHydrate) {
    return;
  }
  for (const id of input.ids) {
    input.seenIds.add(id);
    globalSeenTabIds.add(id);
  }
}

export function isNewTabMotionItem(input: {
  id: string;
  didHydrate: boolean;
  seenIds: ReadonlySet<string>;
}): boolean {
  if (globalSeenTabIds.has(input.id) || input.seenIds.has(input.id)) {
    return false;
  }
  return input.didHydrate;
}

export function resetTabMotionRegistryForTesting(): void {
  globalSeenTabIds.clear();
}

export function resolveTabMotionProgress(width: number, targetWidth: number): number {
  "worklet";
  if (targetWidth <= 0) return 1;
  return Math.min(1, Math.max(0, width / targetWidth));
}

export function resolveTabMotionInitialWidth(input: {
  entering: boolean;
  reducedMotion: boolean;
  targetWidth?: number;
}): number {
  if (input.entering && !input.reducedMotion) {
    return 0;
  }
  if (input.targetWidth && input.targetWidth > 0) {
    return input.targetWidth;
  }
  return MOTION_CLIP_AUTO;
}

export function resolveTabMotionExitFromWidth(currentWidth: number, measuredWidth: number): number {
  if (currentWidth >= 0) {
    return currentWidth;
  }
  return Math.max(0, measuredWidth);
}

/**
 * After enter arms, later layout widths have to move the clip. Skipping them
 * leaves the close control on the old trailing edge while the chip paints past
 * the slot — over the new-tab button, and with the X sitting mid-tab.
 */
export function shouldFollowTabMotionTargetWidth(input: {
  nextWidth: number;
  lastAppliedWidth: number;
  entering: boolean;
  didArmEnter: boolean;
  exiting: boolean;
}): boolean {
  if (input.nextWidth <= 0) {
    return false;
  }
  if (input.exiting) {
    return false;
  }
  if (input.entering && !input.didArmEnter) {
    return false;
  }
  return Math.abs(input.nextWidth - input.lastAppliedWidth) > 0.5;
}

export interface TabMotionFrameStyle {
  width: number | "auto";
  opacity: number;
  marginHorizontal: number;
  overflow: "hidden" | "visible";
  flexShrink: 0;
}

export function resolveTabMotionFrameStyle(input: {
  width: number;
  targetWidth: number;
  opacity: number;
  marginHorizontal: number;
  isAnimating: boolean;
}): TabMotionFrameStyle {
  "worklet";
  // Reanimated keeps the last pixel width unless this property stays in the
  // style object. Explorer chips have no precomputed width; pinning 0 stacks
  // every chip at the origin and paints them on top of one another.
  if (input.width < 0) {
    return {
      width: "auto",
      opacity: input.opacity,
      marginHorizontal: input.marginHorizontal,
      overflow: "visible",
      flexShrink: 0,
    };
  }
  const progress = resolveTabMotionProgress(input.width, input.targetWidth);
  return {
    width: input.width,
    opacity: input.opacity,
    marginHorizontal: input.marginHorizontal * progress,
    overflow: input.isAnimating ? "hidden" : "visible",
    flexShrink: 0,
  };
}

export function waitForTabCloseMotion(reducedMotion = false): Promise<void> {
  if (reducedMotion) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, MOTION_EXIT_DURATION_MS);
  });
}
