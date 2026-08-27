export const EXPAND_WIDTH_FILL = -2;

export interface ExpandWidthFrameStyle {
  width?: number | "100%";
  maxWidth: "100%";
  overflow: "hidden" | "visible";
}

export function resolveExpandWidthFrameStyle(width: number): ExpandWidthFrameStyle {
  "worklet";
  if (width >= 0) {
    return {
      width,
      maxWidth: "100%",
      overflow: "hidden",
    };
  }
  if (width === EXPAND_WIDTH_FILL) {
    return {
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
    };
  }
  return {
    maxWidth: "100%",
    overflow: "visible",
  };
}

export function shouldStretchExpandWidthTrack(input: {
  expanded: boolean;
  sizeLocked: boolean;
  closing: boolean;
}): boolean {
  return input.closing || (input.expanded && input.sizeLocked);
}
