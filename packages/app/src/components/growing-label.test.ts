import { describe, expect, it } from "vitest";
import { splitGrowingLabel } from "./growing-label-parts";

describe("splitGrowingLabel", () => {
  it("fades only the new summary suffix", () => {
    expect(
      splitGrowingLabel(
        "Ran 1 command, read 1 file",
        "Ran 1 command, read 1 file and searched 1 time",
      ),
    ).toEqual({
      prefix: "Ran 1 command, read 1 file",
      incoming: " and searched 1 time",
    });
  });

  it("does not fade the first paint", () => {
    expect(splitGrowingLabel("", "Ran 1 command")).toEqual({
      prefix: "Ran 1 command",
      incoming: "",
    });
  });

  it("fades a replacement that does not share a prefix", () => {
    expect(splitGrowingLabel("Read 1 file", "Ran 1 command")).toEqual({
      prefix: "R",
      incoming: "an 1 command",
    });
  });
});
