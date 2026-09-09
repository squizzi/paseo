import { describe, expect, it } from "vitest";
import {
  advanceTextReveal,
  beginTextReveal,
  isTextRevealSettled,
  visibleRevealedText,
} from "@/agent-stream/text-reveal";
import { retargetTitleReveal } from "./title-reveal";

describe("retargetTitleReveal", () => {
  it("leaves a hydrated title whole", () => {
    const state = beginTextReveal("Investigate search");
    expect(retargetTitleReveal(state, "Investigate search")).toBe(state);
    expect(visibleRevealedText(state)).toBe("Investigate search");
  });

  it("reveals the first non-empty title whole instead of typing it in", () => {
    const state = retargetTitleReveal(beginTextReveal(""), "Investigate search");
    expect(visibleRevealedText(state)).toBe("Investigate search");
    expect(isTextRevealSettled(state)).toBe(true);
  });

  it("retypes a renamed title from the first character", () => {
    const state = retargetTitleReveal(beginTextReveal("Investigate search"), "Fix pagination");
    expect(visibleRevealedText(state)).toBe("");
  });

  it("keeps a shared prefix and streams only the renamed tail", () => {
    const state = retargetTitleReveal(beginTextReveal("Investigate search"), "Investigate bugs");
    expect(visibleRevealedText(state)).toBe("Investigate ");
  });

  it("paces the renamed tail instead of painting it whole", () => {
    const full = "Brand new workspace title";
    let state = retargetTitleReveal(beginTextReveal("Old"), full);
    expect(visibleRevealedText(state)).toBe("");

    state = advanceTextReveal(state, 16);
    const shown = visibleRevealedText(state);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(full.length);
    expect(full.startsWith(shown)).toBe(true);
  });

  it("catches up to the renamed title across frames", () => {
    const full = "Brand new workspace title";
    let state = retargetTitleReveal(beginTextReveal("Old"), full);
    for (let frame = 0; frame < 60 && !isTextRevealSettled(state); frame += 1) {
      state = advanceTextReveal(state, 16);
    }
    expect(isTextRevealSettled(state)).toBe(true);
    expect(visibleRevealedText(state)).toBe(full);
  });
});
