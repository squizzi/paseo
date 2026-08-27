import type { WorkspaceTabDescriptor } from "@/screens/workspace/workspace-tabs-types";

export interface TabDropPreview {
  paneId: string;
  insertionIndex: number;
  indicatorIndex: number;
}

interface ComputeTabDropPreviewInput {
  activePaneId: string;
  activeTabId: string;
  overPaneId: string;
  overTabId: string;
  targetTabs: WorkspaceTabDescriptor[];
  activeRect: {
    left: number;
    width: number;
  };
  overRect: {
    left: number;
    width: number;
  };
}

export function computeTabDropPreview(input: ComputeTabDropPreviewInput): TabDropPreview | null {
  const targetIndex = input.targetTabs.findIndex((tab) => tab.tabId === input.overTabId);
  if (targetIndex < 0 || input.overRect.width <= 0) {
    return null;
  }

  const activeCenterX = input.activeRect.left + input.activeRect.width / 2;
  const overCenterX = input.overRect.left + input.overRect.width / 2;
  const insertAfterTarget = activeCenterX >= overCenterX;

  const indicatorIndex = targetIndex + (insertAfterTarget ? 1 : 0);
  // Same-pane persist must match sortable: the over tab is the arrayMove
  // destination. Leading/trailing half is only for cross-pane insertion.
  if (input.activePaneId !== input.overPaneId) {
    return {
      paneId: input.overPaneId,
      insertionIndex: indicatorIndex,
      indicatorIndex,
    };
  }

  if (!input.targetTabs.some((tab) => tab.tabId === input.activeTabId)) {
    return null;
  }

  return {
    paneId: input.overPaneId,
    insertionIndex: targetIndex,
    indicatorIndex,
  };
}
