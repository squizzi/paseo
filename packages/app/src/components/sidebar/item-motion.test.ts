import { describe, expect, it } from "vitest";
import {
  isNewSidebarMotionItem,
  rememberSidebarMotionItem,
  seedSidebarItemMotionKeys,
  shouldCommitSidebarItemMotionHydration,
  shouldMeasureSidebarItemEnterOffscreen,
  shouldRestoreSidebarItemMotionAfterExit,
  sidebarProjectMotionKey,
  sidebarWorkspaceMotionKey,
} from "./item-motion";

describe("sidebar item motion keys", () => {
  it("does not treat workspaces present at hydrate as new, even if they were collapsed", () => {
    const seenKeys = new Set<string>();
    const collapsedWorkspaceKey = sidebarWorkspaceMotionKey("hidden-workspace");
    const projectKey = sidebarProjectMotionKey("hidden-project");

    seedSidebarItemMotionKeys({
      seenKeys,
      didHydrate: false,
      keys: [projectKey, collapsedWorkspaceKey],
    });

    expect(
      isNewSidebarMotionItem({
        key: collapsedWorkspaceKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(false);
    expect(
      isNewSidebarMotionItem({
        key: projectKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(false);
  });

  it("treats keys that appear after hydrate as new", () => {
    const seenKeys = new Set<string>();
    seedSidebarItemMotionKeys({
      seenKeys,
      didHydrate: false,
      keys: [sidebarWorkspaceMotionKey("existing")],
    });

    const addedKey = sidebarWorkspaceMotionKey("added");
    seedSidebarItemMotionKeys({
      seenKeys,
      didHydrate: true,
      keys: [sidebarWorkspaceMotionKey("existing"), addedKey],
    });

    expect(
      isNewSidebarMotionItem({
        key: addedKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(true);
    expect(
      isNewSidebarMotionItem({
        key: sidebarWorkspaceMotionKey("existing"),
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(false);
  });

  it("treats a newly added workspace as new again after its first mount is rolled back", () => {
    const seenKeys = new Set<string>();
    const existingKey = sidebarWorkspaceMotionKey("existing");
    const addedKey = sidebarWorkspaceMotionKey("added");
    seedSidebarItemMotionKeys({
      seenKeys,
      didHydrate: false,
      keys: [existingKey],
    });

    const forgetAdded = rememberSidebarMotionItem({ seenKeys, key: addedKey });
    expect(
      isNewSidebarMotionItem({
        key: addedKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(false);

    forgetAdded();
    expect(
      isNewSidebarMotionItem({
        key: addedKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(true);
  });

  it("does not forget hydrated keys when a collapsed row unmounts", () => {
    const seenKeys = new Set<string>();
    const hydratedKey = sidebarWorkspaceMotionKey("hidden-workspace");
    seedSidebarItemMotionKeys({
      seenKeys,
      didHydrate: false,
      keys: [hydratedKey],
    });

    const forgetHydrated = rememberSidebarMotionItem({ seenKeys, key: hydratedKey });
    forgetHydrated();
    expect(
      isNewSidebarMotionItem({
        key: hydratedKey,
        didHydrate: true,
        seenKeys,
      }),
    ).toBe(false);
  });

  it("does not commit hydration until the registry is loaded and every host directory is ready", () => {
    expect(
      shouldCommitSidebarItemMotionHydration({
        enabled: true,
        hostRegistryLoaded: false,
        isLoading: false,
      }),
    ).toBe(false);
    expect(
      shouldCommitSidebarItemMotionHydration({
        enabled: true,
        hostRegistryLoaded: true,
        isLoading: true,
      }),
    ).toBe(false);
    expect(
      shouldCommitSidebarItemMotionHydration({
        enabled: false,
        hostRegistryLoaded: true,
        isLoading: false,
      }),
    ).toBe(false);
    expect(
      shouldCommitSidebarItemMotionHydration({
        enabled: true,
        hostRegistryLoaded: true,
        isLoading: false,
      }),
    ).toBe(true);
  });

  it("restores after a failed leave only when exit motion actually armed", () => {
    expect(
      shouldRestoreSidebarItemMotionAfterExit({
        exiting: false,
        didArmExit: true,
      }),
    ).toBe(true);
    expect(
      shouldRestoreSidebarItemMotionAfterExit({
        exiting: true,
        didArmExit: true,
      }),
    ).toBe(false);
    expect(
      shouldRestoreSidebarItemMotionAfterExit({
        exiting: false,
        didArmExit: false,
      }),
    ).toBe(false);
  });

  it("measures a newly added item offscreen so its first layout does not push project names", () => {
    expect(
      shouldMeasureSidebarItemEnterOffscreen({
        entering: true,
        hasMeasuredEnter: false,
      }),
    ).toBe(true);
    expect(
      shouldMeasureSidebarItemEnterOffscreen({
        entering: true,
        hasMeasuredEnter: true,
      }),
    ).toBe(false);
    expect(
      shouldMeasureSidebarItemEnterOffscreen({
        entering: false,
        hasMeasuredEnter: false,
      }),
    ).toBe(false);
  });
});
