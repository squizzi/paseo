export const SIDEBAR_ITEM_MOTION_DURATION_MS = 180;
export const SIDEBAR_ITEM_MOTION_OFFSET = 8;
/** Shared-value sentinel: do not constrain height so collapse/expand can reflow. */
export const SIDEBAR_ITEM_MOTION_AUTO_HEIGHT = -1;

export function sidebarProjectMotionKey(viewKey: string): string {
  return `project:${viewKey}`;
}

export function sidebarWorkspaceMotionKey(workspaceKey: string): string {
  return `workspace:${workspaceKey}`;
}

export function seedSidebarItemMotionKeys(input: {
  seenKeys: Set<string>;
  didHydrate: boolean;
  keys: readonly string[];
}): void {
  if (input.didHydrate) {
    return;
  }
  for (const key of input.keys) {
    input.seenKeys.add(key);
  }
}

export function isNewSidebarMotionItem(input: {
  key: string;
  didHydrate: boolean;
  seenKeys: ReadonlySet<string>;
}): boolean {
  return input.didHydrate && !input.seenKeys.has(input.key);
}

export function rememberSidebarMotionItem(input: {
  seenKeys: Set<string>;
  key: string;
}): () => void {
  const alreadySeen = input.seenKeys.has(input.key);
  input.seenKeys.add(input.key);
  return () => {
    if (!alreadySeen) {
      input.seenKeys.delete(input.key);
    }
  };
}

export function shouldMeasureSidebarItemEnterOffscreen(input: {
  entering: boolean;
  hasMeasuredEnter: boolean;
}): boolean {
  return input.entering && !input.hasMeasuredEnter;
}

export function shouldCommitSidebarItemMotionHydration(input: {
  enabled: boolean;
  hostRegistryLoaded: boolean;
  isLoading: boolean;
}): boolean {
  return input.enabled && input.hostRegistryLoaded && !input.isLoading;
}

export function shouldRestoreSidebarItemMotionAfterExit(input: {
  exiting: boolean;
  didArmExit: boolean;
}): boolean {
  return !input.exiting && input.didArmExit;
}

interface SidebarItemMotionFrameStyle {
  height: number | "auto";
  opacity: number;
  overflow: "hidden" | "visible";
  transform: [{ translateY: number }];
}

export function resolveSidebarItemMotionFrameStyle(input: {
  height: number;
  opacity: number;
  offset: number;
}): SidebarItemMotionFrameStyle {
  "worklet";
  const transform: [{ translateY: number }] = [{ translateY: input.offset }];
  if (input.height >= 0) {
    return {
      height: input.height,
      opacity: input.opacity,
      overflow: "hidden",
      transform,
    };
  }
  // Reanimated keeps the last pixel height unless this property stays in the
  // style object. Omitting it leaves labels painting over the row below.
  return {
    height: "auto",
    opacity: input.opacity,
    overflow: "visible",
    transform,
  };
}
