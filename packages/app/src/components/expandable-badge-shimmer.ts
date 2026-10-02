import { useRef } from "react";

export interface ShimmerSweep {
  durationSeconds: number;
  peakWidth: number;
  trackStart: number;
  trackEnd: number;
  rowWidth: number;
  rowHeight: number;
}

export interface ShimmerMetricsInput {
  label: string;
  secondaryLabel: string | undefined;
  isLoading: boolean;
  isWeb: boolean;
  isNative: boolean;
  labelRowWidth: number;
  labelRowHeight: number;
  labelOffsetX: number;
  labelWidth: number;
  secondaryOffsetX: number;
  secondaryWidth: number;
}

export interface ShimmerMetrics {
  sweep: ShimmerSweep;
  isWebShimmer: boolean;
  shouldMeasureWebShimmer: boolean;
  shouldMeasureNativeShimmer: boolean;
  isNativeShimmer: boolean;
  isMeasured: boolean;
}

export interface RetainedShimmerMetrics extends ShimmerMetrics {
  shimmerDuration: number;
  peakWidth: number;
  trackStart: number;
  trackEnd: number;
  rowWidth: number;
  rowHeight: number;
}

export interface ShimmerLoopFields {
  durationSeconds: number;
  peakWidth: number;
  trackStart: number;
  trackEnd: number;
  rowWidth: number;
  rowHeight: number;
}

/**
 * Keep the loop-defining fields stable while the summary text keeps changing.
 * Changing duration or peak width on every extra word restarts the
 * CSS/Reanimated loop and flashes the letters. The native loop rebuilds its
 * `withTiming` target from `rowWidth`, so that has to freeze too or layout
 * growth keeps restarting it the same way. `trackStart`/`rowWidth`/`rowHeight`
 * freeze once measured. `trackEnd` is still allowed to move so the web sweep
 * covers a label that keeps growing, but only forward: re-deriving it from
 * the live layout on every update (including when a replaced summary string
 * happens to measure narrower) was the actual source of the reset the loop
 * fields were supposed to prevent.
 *
 * Locking in happens on the first *measured* snapshot, not the first
 * snapshot period — `computeShimmerMetrics` floors `peakWidth` to a nonzero
 * minimum even before layout has run, so `peakWidth > 0` can't tell "real
 * layout" apart from "no layout yet." `isMeasured` carries that signal
 * instead; until it's true, nothing gets locked in.
 */
export function retainShimmerLoopFields(input: {
  isLoading: boolean;
  isMeasured: boolean;
  live: ShimmerLoopFields;
  retained: ShimmerLoopFields | null;
}): ShimmerLoopFields | null {
  if (!input.isLoading) {
    return null;
  }
  if (!input.isMeasured) {
    return input.retained;
  }
  if (input.retained === null) {
    return input.live;
  }
  return {
    ...input.retained,
    trackEnd: Math.max(input.retained.trackEnd, input.live.trackEnd),
  };
}

export function computeShimmerMetrics(input: ShimmerMetricsInput): ShimmerMetrics {
  const totalShimmerChars = input.label.trim().length + (input.secondaryLabel?.trim().length ?? 0);
  const shortTextDurationAdjustment = totalShimmerChars <= 12 ? 0.25 : 0;
  const durationSeconds = Math.max(
    1,
    Math.min(2.3, 1.25 + totalShimmerChars * 0.008 - shortTextDurationAdjustment),
  );
  const nativePeakWidth = Math.max(
    32,
    Math.min(120, input.labelRowWidth > 0 ? input.labelRowWidth * 0.28 : 0),
  );
  const isWebShimmer = input.isLoading && input.isWeb;
  const shouldMeasureWebShimmer = input.isWeb;
  const shouldMeasureNativeShimmer = input.isLoading && input.isNative;
  const isNativeShimmer =
    shouldMeasureNativeShimmer && input.labelRowWidth > 0 && input.labelRowHeight > 0;
  const webShimmerSpanStartX = input.labelOffsetX;
  const webShimmerSpanEndX = input.secondaryLabel
    ? input.secondaryOffsetX + input.secondaryWidth
    : input.labelOffsetX + input.labelWidth;
  const webShimmerSpanWidth = Math.max(1, webShimmerSpanEndX - webShimmerSpanStartX);
  const webShimmerPeakWidth = Math.max(42, Math.min(120, webShimmerSpanWidth * 0.22));
  const isMeasured = input.isNative
    ? input.labelRowWidth > 0 && input.labelRowHeight > 0
    : input.labelWidth > 0;
  return {
    sweep: {
      durationSeconds,
      peakWidth: input.isNative ? nativePeakWidth : webShimmerPeakWidth,
      trackStart: webShimmerSpanStartX - webShimmerPeakWidth,
      trackEnd: webShimmerSpanEndX,
      rowWidth: input.labelRowWidth,
      rowHeight: input.labelRowHeight,
    },
    isWebShimmer,
    shouldMeasureWebShimmer,
    shouldMeasureNativeShimmer,
    isNativeShimmer,
    isMeasured,
  };
}

export function useRetainedShimmerMetrics(input: ShimmerMetricsInput): RetainedShimmerMetrics {
  const retainedFieldsRef = useRef<ShimmerLoopFields | null>(null);
  const liveMetrics = computeShimmerMetrics(input);
  const retainedFields = retainShimmerLoopFields({
    isLoading: input.isLoading,
    isMeasured: liveMetrics.isMeasured,
    live: liveMetrics.sweep,
    retained: retainedFieldsRef.current,
  });
  retainedFieldsRef.current = retainedFields;
  const loopFields = retainedFields ?? liveMetrics.sweep;
  return {
    ...liveMetrics,
    shimmerDuration: loopFields.durationSeconds,
    peakWidth: loopFields.peakWidth,
    trackStart: loopFields.trackStart,
    trackEnd: loopFields.trackEnd,
    rowWidth: loopFields.rowWidth,
    rowHeight: loopFields.rowHeight,
  };
}
