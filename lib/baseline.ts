import { istBucketParts, readBucketSamples } from "./history";
import type { ContentSectionId } from "./types";

export const CALIBRATING_MIN_SAMPLES = 14;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Median Absolute Deviation (raw, not scaled). */
export function mad(values: number[], med = median(values)): number {
  if (values.length === 0) return 0;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

/** Logistic sigmoid mapped roughly to useful deviation range. */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * PulseScore v1 blend:
 *   0.6 * v0 + 0.4 * (sigmoid(deviation) * 100)
 * Cold-start: <14 samples in bucket → return v0 + calibrating=true.
 */
export function blendWithBaseline(input: {
  section: ContentSectionId;
  sectionRaw: number;
  scoreV0: number;
  at?: Date;
}): { score: number; calibrating: boolean; deviation?: number } {
  const at = input.at ?? new Date();
  const { hourIst, weekdayIst } = istBucketParts(at);
  const samples = readBucketSamples(
    input.section,
    hourIst,
    weekdayIst,
    at.getTime()
  );

  if (samples.length < CALIBRATING_MIN_SAMPLES) {
    return { score: input.scoreV0, calibrating: true };
  }

  const med = median(samples);
  const m = mad(samples, med);
  // Avoid div-by-zero when history is flat
  const denom = Math.max(m, 0.5);
  const deviation = (input.sectionRaw - med) / denom;
  const score = Math.round(
    0.6 * input.scoreV0 + 0.4 * sigmoid(deviation) * 100
  );
  return {
    score: Math.max(0, Math.min(100, score)),
    calibrating: false,
    deviation,
  };
}
