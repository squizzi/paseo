interface WorkspaceTabTrackAlignTab {
  tab: { key: string };
}

interface WorkspaceTabTrackAlignLabel {
  key: string;
  label: string;
}

export interface WorkspaceTabTrackAlignSnapshot<T extends WorkspaceTabTrackAlignTab> {
  tabs: T[];
  labels: WorkspaceTabTrackAlignLabel[];
  labelWidths: number[];
}

function isKeyPermutation(liveKeys: string[], snapshotKeys: string[]): boolean {
  if (liveKeys.length !== snapshotKeys.length) {
    return false;
  }
  const snapshotKeySet = new Set(snapshotKeys);
  if (snapshotKeySet.size !== snapshotKeys.length) {
    return false;
  }
  return liveKeys.every((key) => snapshotKeySet.has(key));
}

export function resolveDisplayedWorkspaceTabTrack<T extends WorkspaceTabTrackAlignTab>(input: {
  tabs: T[];
  tabLabels: WorkspaceTabTrackAlignLabel[];
  snapshot: WorkspaceTabTrackAlignSnapshot<T> | null;
}): { tabs: T[]; labelWidths: number[] } | null {
  const snapshot = input.snapshot;
  if (!snapshot) {
    return null;
  }

  const snapshotKeys = snapshot.tabs.map((item) => item.tab.key);
  const liveKeys = input.tabs.map((item) => item.tab.key);
  if (isKeyPermutation(liveKeys, snapshotKeys)) {
    const widthByKey = new Map(
      snapshot.tabs.map((item, index) => [item.tab.key, snapshot.labelWidths[index] ?? 0]),
    );
    return {
      tabs: input.tabs,
      labelWidths: liveKeys.map((key) => widthByKey.get(key) ?? 0),
    };
  }

  const currentByKey = new Map(
    input.tabs.map((item, index) => [
      item.tab.key,
      { tab: item, label: input.tabLabels[index]?.label },
    ]),
  );
  return {
    tabs: snapshot.tabs.map((snapshotTab, index) => {
      const current = currentByKey.get(snapshotTab.tab.key);
      return current?.label === snapshot.labels[index]?.label ? current.tab : snapshotTab;
    }),
    labelWidths: snapshot.labelWidths,
  };
}
