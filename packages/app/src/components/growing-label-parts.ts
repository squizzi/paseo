export interface GrowingLabelParts {
  prefix: string;
  incoming: string;
}

/**
 * First paint is already on screen. Growth fades only the new suffix so the
 * existing "Ran 1 command, read 1 file" does not flash when a search is added.
 */
export function splitGrowingLabel(previous: string, next: string): GrowingLabelParts {
  if (previous.length === 0 || next === previous) {
    return { prefix: next, incoming: "" };
  }
  let index = 0;
  const limit = Math.min(previous.length, next.length);
  while (index < limit && previous[index] === next[index]) {
    index += 1;
  }
  return { prefix: next.slice(0, index), incoming: next.slice(index) };
}
