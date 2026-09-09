import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { createPullRequestActivitySortStore } from "./activity-sort-store";

function createMemoryStorage(initial?: Record<string, string>): StateStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    values,
    getItem: async (name) => values.get(name) ?? null,
    setItem: async (name, value) => {
      values.set(name, value);
    },
    removeItem: async (name) => {
      values.delete(name);
    },
  };
}

describe("pull request activity sort store", () => {
  it("defaults to oldest first", async () => {
    const store = createPullRequestActivitySortStore(createMemoryStorage());
    await store.persist.rehydrate();

    expect(store.getState().sort).toBe("oldest");
  });

  it("remembers newest-first across PR views", async () => {
    const storage = createMemoryStorage();
    const first = createPullRequestActivitySortStore(storage);
    await first.persist.rehydrate();

    first.getState().setSort("newest");

    const restored = createPullRequestActivitySortStore(storage);
    await restored.persist.rehydrate();
    expect(restored.getState().sort).toBe("newest");
  });

  it("clears an invalid persisted sort instead of guessing", async () => {
    const storage = createMemoryStorage({
      "pull-request-activity-sort": JSON.stringify({
        state: { sort: "popular" },
        version: 1,
      }),
    });
    const store = createPullRequestActivitySortStore(storage);
    await store.persist.rehydrate();

    expect(store.getState().sort).toBe("oldest");
    expect(storage.values.has("pull-request-activity-sort")).toBe(false);
  });
});
