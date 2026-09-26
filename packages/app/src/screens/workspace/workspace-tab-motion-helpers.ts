import { MOTION_EXIT_DURATION_MS } from "@/styles/motion-tokens";

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

export interface TabMotionFrameStyle {
  width: number;
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
