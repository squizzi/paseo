import { describe, expect, it } from "vitest";
import { splitGrowingLabel } from "./growing-label-parts";

describe("splitGrowingLabel", () => {
  it("grows in only the new summary suffix", () => {
    expect(
      splitGrowingLabel(
        "Ran 1 command, read 1 file",
        "Ran 1 command, read 1 file and searched 1 time",
      ),
    ).toEqual({
      prefix: "Ran 1 command, read 1 file",
      incoming: " and searched 1 time",
      outgoing: "",
    });
  });

  it("does not fade the first paint", () => {
    expect(splitGrowingLabel("", "Ran 1 command")).toEqual({
      prefix: "Ran 1 command",
      incoming: "",
      outgoing: "",
    });
  });

  it("fades a replacement that does not share a prefix", () => {
    expect(splitGrowingLabel("Read 1 file", "Ran 1 command")).toEqual({
      prefix: "R",
      incoming: "an 1 command",
      outgoing: "ead 1 file",
    });
  });

  it("shrinks out a removed suffix", () => {
    expect(splitGrowingLabel("Ran 1 command, read 1 file", "Ran 1 command")).toEqual({
      prefix: "Ran 1 command",
      incoming: "",
      outgoing: ", read 1 file",
    });
  });
});
