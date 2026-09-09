import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "lucide-react-native";
import { withUnistyles } from "react-native-unistyles";
import { GitMergeQueueIcon } from "@/components/icons/git-merge-queue-icon";
import type { Theme } from "@/styles/theme";
import type { PullRequestPresentationState } from "@/git/pr-hint";

const ThemedGitPullRequest = withUnistyles(GitPullRequest);
const ThemedGitPullRequestDraft = withUnistyles(GitPullRequestDraft);
const ThemedGitMerge = withUnistyles(GitMerge);
const ThemedGitPullRequestClosed = withUnistyles(GitPullRequestClosed);
const ThemedGitMergeQueue = withUnistyles(GitMergeQueueIcon);

const successMapping = (theme: Theme) => ({ color: theme.colors.statusSuccess });
const mutedMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const warningMapping = (theme: Theme) => ({ color: theme.colors.statusWarning });
const mergedMapping = (theme: Theme) => ({ color: theme.colors.statusMerged });
const dangerMapping = (theme: Theme) => ({ color: theme.colors.statusDanger });

const PRESENTATION = {
  open: { Icon: ThemedGitPullRequest, color: successMapping },
  draft: { Icon: ThemedGitPullRequestDraft, color: mutedMapping },
  queued: { Icon: ThemedGitMergeQueue, color: warningMapping },
  merged: { Icon: ThemedGitMerge, color: mergedMapping },
  closed: { Icon: ThemedGitPullRequestClosed, color: dangerMapping },
} as const;

/** The canonical state glyph and color shared by every pull-request badge. */
export function PullRequestStateIcon({
  state,
  size,
  strokeWidth,
}: {
  state: PullRequestPresentationState;
  size: number;
  strokeWidth?: number;
}) {
  const { Icon, color } = PRESENTATION[state];
  return <Icon size={size} strokeWidth={strokeWidth} uniProps={color} />;
}
