import { describe, expect, it } from "vitest";

import { buildAgentBranchNameSeed, buildAgentPrompt } from "./prompt-attachments.js";

describe("prompt attachments", () => {
  it("places fork history before the new user prompt", () => {
    const chatHistory = {
      type: "text" as const,
      mimeType: "text/plain",
      contextKind: "chat_history" as const,
      title: "Chat history",
      text: "<chat-history-summary>\nPrevious work\n</chat-history-summary>",
    };
    const issue = {
      type: "github_issue" as const,
      mimeType: "application/github-issue",
      number: 55,
      title: "Issue",
      url: "https://github.com/getpaseo/paseo/issues/55",
    };

    expect(
      buildAgentPrompt(
        "  Take a different approach  ",
        [{ data: "image-data", mimeType: "image/png" }],
        [issue, chatHistory],
      ),
    ).toEqual([
      chatHistory,
      { type: "text", text: "Take a different approach" },
      { type: "image", data: "image-data", mimeType: "image/png" },
      issue,
    ]);
  });

  it("returns undefined when firstAgentContext is empty", () => {
    expect(buildAgentBranchNameSeed(undefined)).toBeUndefined();
    expect(buildAgentBranchNameSeed({})).toBeUndefined();
    expect(buildAgentBranchNameSeed({ prompt: "   " })).toBeUndefined();
    expect(buildAgentBranchNameSeed({ attachments: [] })).toBeUndefined();
  });

  it("wraps prompt and rendered attachments as tagged naming input", () => {
    expect(
      buildAgentBranchNameSeed({
        prompt: "Investigate flaky test",
        attachments: [
          {
            type: "github_pr",
            mimeType: "application/github-pr",
            number: 123,
            title: "Fix worktree naming",
            url: "https://github.com/getpaseo/paseo/pull/123",
            baseRefName: "main",
            headRefName: "fix/worktree-naming",
          },
        ],
      }),
    ).toBe(
      "<user-prompt>\nInvestigate flaky test\n</user-prompt>\n\n<attachments>\nGitHub PR #123: Fix worktree naming\nhttps://github.com/getpaseo/paseo/pull/123\nBase: main\nHead: fix/worktree-naming\n</attachments>",
    );
  });
});
