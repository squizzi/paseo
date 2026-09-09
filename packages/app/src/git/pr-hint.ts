import { normalizeForge, type Forge } from "@/git/forge";
import type { PresentableCheck } from "@/git/check-presentation";

export type PullRequestPresentationState = "open" | "draft" | "queued" | "merged" | "closed";

export interface PrHint {
  url: string;
  number: number;
  state: Exclude<PullRequestPresentationState, "draft">;
  /** Forge backing this change request, so badges render the right brand mark. */
  forge: Forge;
  checks?: PrHintCheck[];
  checksStatus?: "none" | "pending" | "success" | "failure";
  reviewDecision?: "approved" | "changes_requested" | "pending" | null;
}

export interface PrHintCheck extends PresentableCheck {
  name: string;
  url: string | null;
}

interface PrStatusLike {
  url: string;
  state: string;
  isMerged: boolean;
  isDraft?: boolean;
  isInMergeQueue?: boolean;
  checks?: PrHintCheck[];
  checksStatus?: string;
  reviewDecision?: string | null;
  forge?: string;
  forgeSpecific?: unknown;
  github?: unknown;
}

function parsePullRequestNumber(url: string): number | null {
  try {
    const pathname = new URL(url).pathname;
    // GitHub uses /pull/N, Gitea/Forgejo /pulls/N, GitLab /-/merge_requests/N.
    // Match any so a non-GitHub change-request summary yields a hint (and brand mark).
    const match = pathname.match(/\/(?:pull|pulls|merge_requests)\/(\d+)(?:\/|$)/);
    if (!match) {
      return null;
    }

    const number = Number.parseInt(match[1], 10);
    return Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readIsInMergeQueue(status: {
  isInMergeQueue?: boolean;
  forgeSpecific?: unknown;
  github?: unknown;
}): boolean {
  if (status.isInMergeQueue === true) {
    return true;
  }
  if (isRecord(status.forgeSpecific) && status.forgeSpecific.isInMergeQueue === true) {
    return true;
  }
  return isRecord(status.github) && status.github.isInMergeQueue === true;
}

/** Shared open/draft/queued/merged/closed mapping for every PR status surface. */
export function derivePullRequestPresentationState(status: {
  state: string;
  isMerged: boolean;
  isDraft?: boolean;
  isInMergeQueue?: boolean;
  forgeSpecific?: unknown;
  github?: unknown;
}): PullRequestPresentationState {
  if (status.isMerged || status.state === "merged") {
    return "merged";
  }
  if (status.state !== "open") {
    return "closed";
  }
  if (readIsInMergeQueue(status)) {
    return "queued";
  }
  if (status.isDraft) {
    return "draft";
  }
  return "open";
}

export function selectPrHintFromStatus(
  status: PrStatusLike | null | undefined,
  forge?: string | null,
): PrHint | null {
  if (!status?.url) {
    return null;
  }

  const number = parsePullRequestNumber(status.url);
  if (number === null) {
    return null;
  }

  const presentation = derivePullRequestPresentationState(status);
  const state = presentation === "draft" ? "open" : presentation;

  return {
    url: status.url,
    number,
    state,
    forge: normalizeForge(forge ?? status.forge),
    checks: status.checks,
    checksStatus: status.checksStatus as PrHint["checksStatus"],
    reviewDecision: status.reviewDecision as PrHint["reviewDecision"],
  };
}
