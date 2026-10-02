import { describe, expect, it } from "vitest";
import { splitComposerAttachmentsForSubmit } from "@/composer/attachments/submit";
import {
  createPastedTextAttachment,
  formatPastedTextDate,
  isLargePastedText,
  LARGE_PASTED_TEXT_CHAR_THRESHOLD,
  LARGE_PASTED_TEXT_LINE_THRESHOLD,
} from "./pasted-text";

describe("pasted-text", () => {
  it("detects text exceeding the character threshold as large", () => {
    const shortText = "a".repeat(100);
    const exactThreshold = "a".repeat(LARGE_PASTED_TEXT_CHAR_THRESHOLD);

    expect(isLargePastedText(shortText)).toBe(false);
    expect(isLargePastedText(exactThreshold)).toBe(true);
  });

  it("detects multiline text exceeding the line threshold as large", () => {
    const lines = Array.from(
      { length: LARGE_PASTED_TEXT_LINE_THRESHOLD },
      (_, i) => `Line ${i + 1}: ${"x".repeat(30)}`,
    ).join("\n");
    expect(lines.length).toBeGreaterThanOrEqual(400);
    expect(isLargePastedText(lines)).toBe(true);

    const fewLines = "line 1\nline 2\nline 3";
    expect(isLargePastedText(fewLines)).toBe(false);
  });

  it("formats title with Pasted Text and the formatted date", () => {
    const testDate = new Date("2026-10-02T13:45:00Z");
    const formatted = formatPastedTextDate(testDate);
    const attachment = createPastedTextAttachment("Sample text content", testDate);

    expect(attachment.kind).toBe("pasted_text");
    expect(attachment.title).toBe(`Pasted Text (${formatted})`);
    expect(attachment.text).toBe("Sample text content");
    expect(attachment.createdAt).toBe(testDate.getTime());
    expect(attachment.id).toMatch(/^paste-\d+-[a-z0-9]+$/);
  });

  it("converts pasted text attachments for submit", () => {
    const attachment = createPastedTextAttachment("Large log output\nline 2");
    const result = splitComposerAttachmentsForSubmit([attachment]);

    expect(result.images).toEqual([]);
    expect(result.attachments).toEqual([
      {
        type: "text",
        mimeType: "text/plain",
        title: attachment.title,
        text: "Large log output\nline 2",
      },
    ]);
  });
});
