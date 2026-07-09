import { blendWithBaseline } from "./baseline";
import { isBootWindowCluster, processBootAt } from "./boot";
import { writeHistorySample } from "./history";
import type { HighlightItem, SectionScore, TrafficLevel } from "./types";
import type { ContentSectionId } from "./types";
import { sectionLabel } from "./types";

const K = 8;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Max sources whose firstSeen fall inside any rolling 60-minute span.
 * Boot-window clusters (all sources observed at cold start) → velocity 1
 * so we count breadth only — prevents false 🔴 after restart/deploy.
 */
export function computeVelocity(
  firstSeens: string[],
  now = Date.now(),
  bootAt = processBootAt()
): number {
  if (isBootWindowCluster(firstSeens, bootAt)) {
    return 1;
  }

  const times = firstSeens
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t) && t <= now)
    .sort((a, b) => a - b);

  if (times.length === 0) return 0;
  if (times.length === 1) return 1;

  let max = 1;
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > HOUR_MS) left++;
    max = Math.max(max, right - left + 1);
  }
  return max;
}

export function recencyWeight(ageHours: number): number {
  return Math.exp(-ageHours / 6);
}

export function storyHeat(input: {
  breadth: number;
  velocity: number;
  ageHours: number;
}): number {
  const { breadth, velocity, ageHours } = input;
  return (2 * breadth + 3 * velocity) * recencyWeight(ageHours);
}

export function saturateScore(sectionRaw: number): number {
  if (sectionRaw <= 0) return 0;
  return Math.round((100 * sectionRaw) / (sectionRaw + K));
}

export function trafficLevel(score: number): TrafficLevel {
  if (score >= 70) return "red";
  if (score >= 40) return "yellow";
  return "green";
}

export function enrichItemHeat(
  item: HighlightItem,
  now = Date.now()
): HighlightItem {
  const firstSeens = item.sources.map(
    (s) => s.firstSeen || item.publishedAt
  );
  const firstSeen = firstSeens.reduce((a, b) =>
    new Date(a).getTime() <= new Date(b).getTime() ? a : b
  );
  const breadth = Math.max(1, new Set(item.sources.map((s) => s.name)).size);
  // Ensure boot clock is stamped before first score (deploy / cold start)
  processBootAt();
  const velocity = computeVelocity(firstSeens, now);
  const ageHours = Math.max(
    0,
    (now - new Date(item.publishedAt).getTime()) / HOUR_MS
  );
  const heat = storyHeat({ breadth, velocity, ageHours });

  return {
    ...item,
    heat,
    velocity,
    firstSeen,
    hot: item.hot || breadth >= 2,
  };
}

export function sectionRawFromHeats(heats: number[]): number {
  if (heats.length === 0) return 0;
  const sorted = [...heats].sort((a, b) => b - a);
  const max = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  return max + 0.5 * second;
}

export function scoreSection(
  section: ContentSectionId,
  items: HighlightItem[],
  now = Date.now(),
  opts?: { persistHistory?: boolean }
): SectionScore {
  const enriched = items.map((i) => enrichItemHeat(i, now));
  const heats = enriched.map((i) => i.heat ?? 0);
  const raw = sectionRawFromHeats(heats);
  const scoreV0 = saturateScore(raw);
  const top = [...enriched].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0];
  const topBreadth = top
    ? new Set(top.sources.map((s) => s.name)).size
    : 0;

  // Moat clock: write every score cycle (warm + request). Skip in PW_TEST
  // unless explicitly enabled so fixtures stay deterministic.
  const shouldPersist =
    opts?.persistHistory ??
    (process.env.PW_TEST !== "1" || process.env.PW_HISTORY === "1");
  if (shouldPersist) {
    writeHistorySample({
      section,
      sectionRaw: raw,
      clusterCount: enriched.length,
      topBreadth,
      at: new Date(now),
    });
  }

  const blended = blendWithBaseline({
    section,
    sectionRaw: raw,
    scoreV0,
    at: new Date(now),
  });
  const score = blended.score;

  let topSpanMinutes: number | undefined;
  if (top) {
    const times = top.sources
      .map((s) => new Date(s.firstSeen || top.publishedAt).getTime())
      .sort((a, b) => a - b);
    if (times.length >= 2) {
      topSpanMinutes = Math.max(
        1,
        Math.round((times[times.length - 1] - times[0]) / 60_000)
      );
    } else {
      topSpanMinutes = 1;
    }
  }

  // Tiny sparkline series for 🔴 chips (last N heats in section, newest last)
  const velocitySpark =
    trafficLevel(score) === "red"
      ? enriched
          .slice()
          .sort(
            (a, b) =>
              new Date(a.publishedAt).getTime() -
              new Date(b.publishedAt).getTime()
          )
          .slice(-6)
          .map((i) => Math.round((i.heat ?? 0) * 10) / 10)
      : undefined;

  return {
    section,
    score,
    level: trafficLevel(score),
    calibrating: blended.calibrating,
    topHeat: top?.heat,
    topText: top?.text,
    topBreadth: topBreadth || undefined,
    topVelocity: top?.velocity,
    topSpanMinutes,
    velocitySpark,
  };
}

/** Shorten a headline to ~8 words for verdict templates. */
export function eightWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 8) return words.join(" ");
  return `${words.slice(0, 8).join(" ")}…`;
}

export function describeScore(score: SectionScore): string {
  return `${sectionLabel(score.section)} ${score.score}`;
}
