export interface GrowingLabelParts {
  prefix: string;
  incoming: string;
  outgoing: string;
}

/**
 * First paint is already on screen. Growth grows in only the new suffix so
 * the existing "Ran 1 command, read 1 file" does not flash when a search is
 * added. `outgoing` is whatever tail of `previous` no longer matches `next`
 * (a shrink, or a divergence mid-string) so the caller can shrink it out
 * instead of having it vanish.
 */
export function splitGrowingLabel(previous: string, next: string): GrowingLabelParts {
  if (previous.length === 0 || next === previous) {
    return { prefix: next, incoming: "", outgoing: "" };
  }
  let index = 0;
  const limit = Math.min(previous.length, next.length);
  while (index < limit && previous[index] === next[index]) {
    index += 1;
  }
  return {
    prefix: next.slice(0, index),
    incoming: next.slice(index),
    outgoing: previous.slice(index),
  };
}
