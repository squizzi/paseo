import { describe, expect, it } from "vitest";
import { mergeSubagentDisplayOrder, resolveSubagentDisplayRows } from "./track-exit-motion";
import type { PaseoSubagentRow } from "./select";

function row(id: string): PaseoSubagentRow {
  return {
    kind: "paseo",
    id,
    provider: "codex",
    title: id,
    description: null,
    subtitle: null,
    status: "idle",
    turn: { phase: "idle", cancellationRequestId: null },
    requiresAttention: false,
    createdAt: new Date(),
  };
}

describe("mergeSubagentDisplayOrder", () => {
  it("keeps a settled order stable when nothing changed", () => {
    const order = mergeSubagentDisplayOrder({
      previousOrder: ["a", "b", "c"],
      liveRowIds: ["a", "b", "c"],
      exitingIds: new Set(),
    });
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("keeps a row's spot while it is still exiting instead of dropping it", () => {
    const order = mergeSubagentDisplayOrder({
      previousOrder: ["a", "b", "c"],
      liveRowIds: ["a", "c"],
      exitingIds: new Set(["b"]),
    });
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("drops an id once it is neither live nor exiting", () => {
    const order = mergeSubagentDisplayOrder({
      previousOrder: ["a", "b", "c"],
      liveRowIds: ["a", "c"],
      exitingIds: new Set(),
    });
    expect(order).toEqual(["a", "c"]);
  });

  it("appends a brand-new live row at the end", () => {
    const order = mergeSubagentDisplayOrder({
      previousOrder: ["a", "b"],
      liveRowIds: ["a", "b", "d"],
      exitingIds: new Set(),
    });
    expect(order).toEqual(["a", "b", "d"]);
  });

  it("starts from scratch on the first render", () => {
    const order = mergeSubagentDisplayOrder({
      previousOrder: [],
      liveRowIds: ["a", "b"],
      exitingIds: new Set(),
    });
    expect(order).toEqual(["a", "b"]);
  });
});

describe("resolveSubagentDisplayRows", () => {
  it("prefers live data over the exiting snapshot", () => {
    const liveA = row("a");
    const staleA = row("a");
    const rows = resolveSubagentDisplayRows({
      order: ["a"],
      liveRows: [liveA],
      exitingSnapshot: new Map([["a", staleA]]),
    });
    expect(rows).toEqual([liveA]);
  });

  it("falls back to the snapshot once a row has left live data", () => {
    const snapshotB = row("b");
    const rows = resolveSubagentDisplayRows({
      order: ["a", "b"],
      liveRows: [row("a")],
      exitingSnapshot: new Map([["b", snapshotB]]),
    });
    expect(rows.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(rows[1]).toBe(snapshotB);
  });

  it("skips an id present in neither source", () => {
    const rows = resolveSubagentDisplayRows({
      order: ["a", "ghost"],
      liveRows: [row("a")],
      exitingSnapshot: new Map(),
    });
    expect(rows.map((entry) => entry.id)).toEqual(["a"]);
  });
});
