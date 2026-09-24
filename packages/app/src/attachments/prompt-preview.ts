import { renderPromptAttachmentAsText } from "@getpaseo/protocol/prompt-attachments";
import { splitComposerAttachmentsForSubmit } from "@/composer/attachments/submit";
import type { ComposerAttachment } from "./types";

export function getComposerAttachmentPromptPreview(attachment: ComposerAttachment): string | null {
  if (attachment.kind === "image") {
    return null;
  }
  const { attachments } = splitComposerAttachmentsForSubmit([attachment]);
  const agentAttachment = attachments[0];
  if (!agentAttachment) {
    return null;
  }
  const preview = renderPromptAttachmentAsText(agentAttachment).trim();
  return preview.length > 0 ? preview : null;
}
