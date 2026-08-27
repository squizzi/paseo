import { describe, expect, it } from "vitest";
import { applyPendingPaneTabOrder } from "@/components/split-container-pending-pane-tabs";
import type { SplitPane } from "@/stores/workspace-layout-actions";

function pane(tabIds: string[]): SplitPane {
  return {
    id: "pane",
    tabIds,
    focusedTabId: tabIds[0] ?? null,
  };
}

describe("applyPendingPaneTabOrder", () => {
  it("keeps the pane unchanged when there is no pending drop", () => {
    const current = pane(["a", "b", "c"]);
    expect(applyPendingPaneTabOrder({ pane: current, pending: null })).toBe(current);
  });

  it("overlays the dropped order so the 2nd tab is already in the middle on drop", () => {
    const current = pane(["a", "b", "c"]);
    expect(
      applyPendingPaneTabOrder({
        pane: current,
        pending: { paneId: "pane", tabIds: ["a", "c", "b"] },
      }).tabIds,
    ).toEqual(["a", "c", "b"]);
  });

  it("returns the committed pane once the store has caught up", () => {
    const current = pane(["a", "c", "b"]);
    expect(
      applyPendingPaneTabOrder({
        pane: current,
        pending: { paneId: "pane", tabIds: ["a", "c", "b"] },
      }),
    ).toBe(current);
  });
});
