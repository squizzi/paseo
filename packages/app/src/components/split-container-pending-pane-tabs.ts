import type { SplitPane } from "@/stores/workspace-layout-actions";

export interface PendingPaneTabOrder {
  paneId: string;
  tabIds: string[];
}

function sameTabIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tabId, index) => tabId === right[index]);
}

export function applyPendingPaneTabOrder(input: {
  pane: SplitPane;
  pending: PendingPaneTabOrder | null;
}): SplitPane {
  if (!input.pending || input.pending.paneId !== input.pane.id) {
    return input.pane;
  }
  if (sameTabIds(input.pane.tabIds, input.pending.tabIds)) {
    return input.pane;
  }
  return {
    ...input.pane,
    tabIds: input.pending.tabIds,
  };
}
