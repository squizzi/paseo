import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";
import { z } from "zod";
import { createValidatedPersistStorage } from "@/storage/validated-persist-storage";
import { DEFAULT_PULL_REQUEST_ACTIVITY_SORT, type PullRequestActivitySort } from "./activity-state";

interface PullRequestActivitySortState {
  sort: PullRequestActivitySort;
  setSort: (sort: PullRequestActivitySort) => void;
}

const PullRequestActivitySortSchema = z.enum(["oldest", "newest"]);
const PersistedPullRequestActivitySortSchema = z.strictObject({
  sort: PullRequestActivitySortSchema,
});

export function createPullRequestActivitySortStore(storage: StateStorage) {
  return create<PullRequestActivitySortState>()(
    persist<
      PullRequestActivitySortState,
      [],
      [],
      z.infer<typeof PersistedPullRequestActivitySortSchema>
    >(
      (set) => ({
        sort: DEFAULT_PULL_REQUEST_ACTIVITY_SORT,
        setSort: (sort) => set({ sort }),
      }),
      {
        name: "pull-request-activity-sort",
        version: 1,
        storage: createValidatedPersistStorage(storage, PersistedPullRequestActivitySortSchema),
        partialize: (state) => ({ sort: state.sort }),
      },
    ),
  );
}

export const usePullRequestActivitySortStore = createPullRequestActivitySortStore(AsyncStorage);
