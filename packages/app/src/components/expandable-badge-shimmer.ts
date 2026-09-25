import { useRef } from "react";

export interface ShimmerSweep {
  durationSeconds: number;
  peakWidth: number;
  trackStart: number;
  trackEnd: number;
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
}

export interface RetainedShimmerMetrics extends ShimmerMetrics {
  shimmerDuration: number;
  peakWidth: number;
  trackStart: number;
  trackEnd: number;
}

/**
 * Keep the running sweep when the label grows. Changing duration or travel on
 * every extra word restarts the CSS/Reanimated loop and flashes the letters.
 */
export function retainShimmerSweep(input: {
  isLoading: boolean;
  live: ShimmerSweep;
  retained: ShimmerSweep | null;
}): ShimmerSweep | null {
  if (!input.isLoading) {
    return null;
  }
  if (input.retained !== null && input.retained.peakWidth > 0) {
    return input.retained;
  }
  return input.live;
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
  return {
    sweep: {
      durationSeconds,
      peakWidth: input.isNative ? nativePeakWidth : webShimmerPeakWidth,
      trackStart: webShimmerSpanStartX - webShimmerPeakWidth,
      trackEnd: webShimmerSpanEndX,
    },
    isWebShimmer,
    shouldMeasureWebShimmer,
    shouldMeasureNativeShimmer,
    isNativeShimmer,
  };
}

export function useRetainedShimmerMetrics(input: ShimmerMetricsInput): RetainedShimmerMetrics {
  const retainedSweepRef = useRef<ShimmerSweep | null>(null);
  const liveMetrics = computeShimmerMetrics(input);
  const sweep = retainShimmerSweep({
    isLoading: input.isLoading,
    live: liveMetrics.sweep,
    retained: retainedSweepRef.current,
  });
  retainedSweepRef.current = sweep;
  const displayed = sweep ?? liveMetrics.sweep;
  return {
    ...liveMetrics,
    shimmerDuration: displayed.durationSeconds,
    peakWidth: displayed.peakWidth,
    trackStart: displayed.trackStart,
    trackEnd: displayed.trackEnd,
  };
}
