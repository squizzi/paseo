import { describe, expect, it } from "vitest";
import { resolveDisplayedWorkspaceTabTrack } from "@/screens/workspace/workspace-desktop-tabs-track";

function tab(key: string): { tab: { key: string }; label: string } {
  return { tab: { key }, label: key };
}

function snapshot(keys: string[], widths: number[]) {
  const tabs = keys.map((key) => tab(key));
  return {
    tabs,
    labels: keys.map((key) => ({ key, label: key })),
    labelWidths: widths,
  };
}

describe("resolveDisplayedWorkspaceTabTrack", () => {
  it("returns null before the track has been measured", () => {
    expect(
      resolveDisplayedWorkspaceTabTrack({
        tabs: [tab("a")],
        tabLabels: [{ key: "a", label: "a" }],
        snapshot: null,
      }),
    ).toBeNull();
  });

  it("keeps snapshot order while a tab is still being added or removed", () => {
    const resolved = resolveDisplayedWorkspaceTabTrack({
      tabs: [tab("a"), tab("b"), tab("c"), tab("e")],
      tabLabels: [
        { key: "a", label: "a" },
        { key: "b", label: "b" },
        { key: "c", label: "c" },
        { key: "e", label: "e" },
      ],
      snapshot: snapshot(["a", "b", "c", "d"], [10, 20, 30, 40]),
    });

    expect(resolved?.tabs.map((item) => item.tab.key)).toEqual(["a", "b", "c", "d"]);
    expect(resolved?.labelWidths).toEqual([10, 20, 30, 40]);
  });

  it("uses live order after a same-pane reorder while the snapshot is still stale", () => {
    const resolved = resolveDisplayedWorkspaceTabTrack({
      tabs: [tab("b"), tab("c"), tab("d"), tab("a")],
      tabLabels: [
        { key: "b", label: "b" },
        { key: "c", label: "c" },
        { key: "d", label: "d" },
        { key: "a", label: "a" },
      ],
      snapshot: snapshot(["a", "b", "c", "d"], [10, 20, 30, 40]),
    });

    expect(resolved?.tabs.map((item) => item.tab.key)).toEqual(["b", "c", "d", "a"]);
    expect(resolved?.labelWidths).toEqual([20, 30, 40, 10]);
  });
});
