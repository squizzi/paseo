import type { PastedTextComposerAttachment } from "./types";

export const LARGE_PASTED_TEXT_CHAR_THRESHOLD = 1000;
export const LARGE_PASTED_TEXT_LINE_THRESHOLD = 15;

export function isLargePastedText(text: string): boolean {
  if (text.length >= LARGE_PASTED_TEXT_CHAR_THRESHOLD) {
    return true;
  }
  if (text.length >= 400 && text.split("\n").length >= LARGE_PASTED_TEXT_LINE_THRESHOLD) {
    return true;
  }
  return false;
}

export function formatPastedTextDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export function createPastedTextAttachment(
  text: string,
  now: Date = new Date(),
): PastedTextComposerAttachment {
  const dateLabel = formatPastedTextDate(now);
  return {
    kind: "pasted_text",
    id: `paste-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Pasted Text (${dateLabel})`,
    text,
    createdAt: now.getTime(),
  };
}
