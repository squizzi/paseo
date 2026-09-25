import { describe, expect, it } from "vitest";
import { splitStreamWordTokens } from "./stream-word-fade";

describe("splitStreamWordTokens", () => {
  it("keeps earlier words stable when a new word arrives", () => {
    expect(splitStreamWordTokens("Ran 1 command")).toEqual(["Ran", " ", "1", " ", "command"]);
    expect(splitStreamWordTokens("Ran 1 command and")).toEqual([
      "Ran",
      " ",
      "1",
      " ",
      "command",
      " ",
      "and",
    ]);
  });

  it("does not split a word that is still being typed", () => {
    expect(splitStreamWordTokens("Hel")).toEqual(["Hel"]);
    expect(splitStreamWordTokens("Hello")).toEqual(["Hello"]);
  });

  it("returns no tokens for empty text", () => {
    expect(splitStreamWordTokens("")).toEqual([]);
  });
});
