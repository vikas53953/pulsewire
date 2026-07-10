import { CALIBRATING_MIN_SAMPLES, median } from "./baseline";

/** Ratio of current velocity to bucket median — null when calibrating. */
export function velocityRatio(
  velocity: number,
  samples: number[],
  minSamples = CALIBRATING_MIN_SAMPLES,
): number | null {
  if (samples.length < minSamples) return null;
  const med = median(samples);
  if (med <= 0) return null;
  return Math.round((velocity / med) * 10) / 10;
}

export function formatVelocityWhy(
  velocity: number,
  source: string,
  ratio: number | null,
): string {
  const velBit = Number.isInteger(velocity)
    ? String(velocity)
    : velocity.toFixed(1);
  if (ratio != null && ratio >= 1.5) {
    const sub = source.startsWith("r/")
      ? source
      : `r/${source.replace(/^r\//i, "")}`;
    return `vel ${velBit} — ${ratio}× normal for ${sub}`;
  }
  return `vel ${velBit}`;
}

/** Accent from ratio when baselined; else raw velocity thresholds. */
export function trendAccentFromVelocity(
  velocity: number | undefined,
  ratio: number | null,
): "hot" | "warm" | "none" {
  if (ratio != null) {
    if (ratio >= 3) return "hot";
    if (ratio >= 1.5) return "warm";
    return "none";
  }
  const v = velocity ?? 0;
  if (v >= 8) return "hot";
  if (v >= 4) return "warm";
  return "none";
}
