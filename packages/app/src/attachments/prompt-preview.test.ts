import { describe, expect, it } from "vitest";
import { renderPromptAttachmentAsText } from "@getpaseo/protocol/prompt-attachments";
import { createWorkspaceFileAttachment } from "./workspace-file";
import { getComposerAttachmentPromptPreview } from "./prompt-preview";
import type { ComposerAttachment } from "./types";

describe("composer attachment prompt preview", () => {
  it("does not preview images because they are sent as image blocks", () => {
    const attachment: ComposerAttachment = {
      kind: "image",
      metadata: {
        id: "img-1",
        mimeType: "image/png",
        storageType: "web-indexeddb",
        storageKey: "img-1",
        createdAt: 1,
      },
    };

    expect(getComposerAttachmentPromptPreview(attachment)).toBeNull();
  });

  it("previews the same workspace-file prompt the agent receives", () => {
    const attachment = createWorkspaceFileAttachment({
      path: "src/app.ts",
      selection: { kind: "line_range", startLine: 12, endLine: 24 },
    });

    expect(getComposerAttachmentPromptPreview(attachment)).toBe(
      "Workspace file: src/app.ts\nLines: 12-24",
    );
  });

  it("previews plugin resource text as the agent prompt", () => {
    const attachment: ComposerAttachment = {
      kind: "plugin_resource",
      pluginId: "linear",
      sourceId: "issues",
      sourceTitle: "Linear issue",
      sourceIcon: "CircleDot",
      item: {
        id: "issue-uuid",
        identifier: "ENG-123",
        title: "Plugin attachments",
        subtitle: "In progress",
        url: "https://linear.app/acme/issue/ENG-123/plugin-attachments",
        text: "Linear issue ENG-123: Plugin attachments\nStatus: In progress",
        resourceType: "issue",
      },
    };

    expect(getComposerAttachmentPromptPreview(attachment)).toBe(
      "Linear issue ENG-123: Plugin attachments\nStatus: In progress",
    );
  });

  it("previews forge change requests with the shared renderer", () => {
    const attachment: ComposerAttachment = {
      kind: "forge_change_request",
      item: {
        kind: "change_request",
        forge: "github",
        number: 123,
        title: "Fix race in worktree setup",
        url: "https://github.com/getpaseo/paseo/pull/123",
        state: "open",
        body: "PR body",
        labels: [],
        baseRefName: "main",
        headRefName: "fix/worktree-race",
      },
    };

    expect(getComposerAttachmentPromptPreview(attachment)).toBe(
      renderPromptAttachmentAsText({
        type: "forge_change_request",
        mimeType: "application/paseo-forge-change-request",
        forge: "github",
        number: 123,
        title: "Fix race in worktree setup",
        url: "https://github.com/getpaseo/paseo/pull/123",
        body: "PR body",
        baseRefName: "main",
        headRefName: "fix/worktree-race",
      }),
    );
  });
});
