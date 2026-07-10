import { CALIBRATING_MIN_SAMPLES, median } from "./baseline";
import {
  istBucketParts,
  readBucketSampleRows,
} from "./history";
import type { ContentSectionId, SectionScore } from "./types";
import { sectionLabel } from "./types";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Percent below bucket median — null when calibrating or not below. */
export function quietPercentBelow(
  sectionRaw: number,
  samples: number[],
  minSamples = CALIBRATING_MIN_SAMPLES,
): number | null {
  if (samples.length < minSamples) return null;
  const med = median(samples);
  if (med <= 0) return null;
  if (sectionRaw >= med) return null;
  return Math.round(((med - sectionRaw) / med) * 100);
}

/**
 * Consecutive quiet days in this hour×weekday bucket (newest first).
 * A day is quiet when its latest section_raw < bucket median.
 * Requires ≥14 samples; otherwise null (never fake a streak).
 */
export function consecutiveQuietDays(input: {
  samples: Array<{ sectionRaw: number; timestamp: string }>;
  currentRaw: number;
  minSamples?: number;
}): { streak: number; quietestSince: string | null } | null {
  const min = input.minSamples ?? CALIBRATING_MIN_SAMPLES;
  if (input.samples.length < min) return null;
  const med = median(input.samples.map((s) => s.sectionRaw));
  if (!(input.currentRaw < med)) return null;

  // Latest sample per calendar day
  const latestByDay = new Map<string, { sectionRaw: number; timestamp: string }>();
  for (const s of input.samples) {
    const day = s.timestamp.slice(0, 10);
    const prev = latestByDay.get(day);
    if (!prev || s.timestamp > prev.timestamp) {
      latestByDay.set(day, s);
    }
  }

  const days = [...latestByDay.keys()].sort().reverse();
  let streak = 0;
  let quietestSince: string | null = null;
  for (const day of days) {
    const raw = latestByDay.get(day)!.sectionRaw;
    if (raw < med) {
      streak += 1;
      quietestSince = day;
    } else {
      break;
    }
  }
  if (streak < 1) streak = 1;

  return { streak, quietestSince };
}

export function quietDeskWhyLine(
  score: SectionScore,
  sectionRaw: number | undefined,
  samples: number[],
  at = new Date(),
): string | null {
  if (score.level !== "green" || score.calibrating || score.unknown) return null;
  if (sectionRaw == null) return null;
  const pct = quietPercentBelow(sectionRaw, samples);
  if (pct == null || pct < 1) return null;
  const { weekdayIst } = istBucketParts(at);
  const dayName = WEEKDAY_NAMES[weekdayIst] ?? "weekday";
  const label = sectionLabel(score.section);
  return `${label} quiet — ${pct}% below a normal ${dayName} hour.`;
}

export function allQuietReceiptLine(
  scores: SectionScore[],
  section: ContentSectionId,
  currentRaw: number,
  at = new Date(),
): string | null {
  if (scores.some((s) => s.calibrating || s.unknown)) return null;
  if (!scores.every((s) => s.level === "green")) return null;

  const { hourIst, weekdayIst } = istBucketParts(at);
  const rows = readBucketSampleRows(section, hourIst, weekdayIst, at.getTime());
  const streak = consecutiveQuietDays({
    samples: rows.map((r) => ({
      sectionRaw: r.sectionRaw,
      timestamp: r.timestamp,
    })),
    currentRaw,
  });
  if (!streak || streak.streak < 2) {
    // quietest hour since — only when we have a long quietestSince and streak≥1
    if (streak?.quietestSince && streak.streak >= 1) {
      // Prefer multi-day streak wording when ≥2; single day → omit
      return null;
    }
    return null;
  }

  const ordinal =
    streak.streak === 2
      ? "2nd"
      : streak.streak === 3
        ? "3rd"
        : `${streak.streak}th`;
  if (streak.quietestSince && streak.streak >= 3) {
    return `${ordinal} consecutive quiet morning · quietest hour since ${streak.quietestSince}`;
  }
  return `${ordinal} consecutive quiet morning`;
}
