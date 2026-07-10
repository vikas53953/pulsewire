import { blendWithBaseline } from "./baseline";
import { isBootWindowCluster, processBootAt } from "./boot";
import { eightWords } from "./copy";
import {
  crossBonus,
  planesPresent,
  weightedBreadth,
} from "./fusion";
import { writeHistorySample } from "./history";
import type {
  ContentSectionId,
  HighlightItem,
  PlaneEvidence,
  SectionScore,
  TrafficLevel,
} from "./types";
import { sectionLabel } from "./types";

export { eightWords, pulseWhy } from "./copy";

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

/**
 * Pulse Score v2 — weighted evidence in rolling 60m (SPEC v4 §3).
 * Falls back to unweighted count when no plane weights available.
 */
export function computeWeightedVelocity(
  evidence: PlaneEvidence[],
  now = Date.now(),
  bootAt = processBootAt()
): number {
  const firstSeens = evidence
    .map((e) => e.firstSeen)
    .filter((iso): iso is string => Boolean(iso));
  if (isBootWindowCluster(firstSeens, bootAt)) {
    return Math.min(1, weightedBreadth(evidence));
  }

  const points = evidence
    .map((e) => ({
      t: e.firstSeen ? new Date(e.firstSeen).getTime() : NaN,
      w:
        e.plane === "tripwire"
          ? 1.5
          : e.plane === "reddit"
            ? 0.6
            : e.plane === "x"
              ? 0.4
              : 1.0,
    }))
    .filter((p) => Number.isFinite(p.t) && p.t <= now)
    .sort((a, b) => a.t - b.t);

  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].w;

  let max = 0;
  let left = 0;
  let sum = 0;
  for (let right = 0; right < points.length; right++) {
    sum += points[right].w;
    while (points[right].t - points[left].t > HOUR_MS) {
      sum -= points[left].w;
      left++;
    }
    max = Math.max(max, sum);
  }
  return max;
}

export function recencyWeight(ageHours: number, windowHours = 24): number {
  // ≤4h keeps legacy τ=6 (scan windows). 12h/24h scale up so morning
  // stories retain heat inside their age band — τ=window/4 alone left 24h
  // identical to before and made 4h crush the board.
  const tau = windowHours <= 4 ? 6 : Math.max(6, windowHours / 2);
  return Math.exp(-ageHours / tau);
}

/** Breadth + velocity (+ plane bonus) with no recency — real signal only. */
export function storyBaseHeat(input: {
  breadth: number;
  velocity: number;
  planes?: Set<string>;
}): number {
  const bonus = input.planes ? crossBonus(input.planes) : 1;
  return (2 * input.breadth + 3 * input.velocity) * bonus;
}

/** Pulse Score v0 heat (RSS-only legacy). */
export function storyHeat(input: {
  breadth: number;
  velocity: number;
  ageHours: number;
  windowHours?: number;
}): number {
  const { breadth, velocity, ageHours, windowHours = 24 } = input;
  return (
    storyBaseHeat({ breadth, velocity }) * recencyWeight(ageHours, windowHours)
  );
}

/** Pulse Score v2 — fusion-aware (SPEC v4 §3). */
export function storyHeatV2(input: {
  breadth: number;
  velocity: number;
  ageHours: number;
  planes: Set<string>;
  windowHours?: number;
}): number {
  return (
    storyBaseHeat({
      breadth: input.breadth,
      velocity: input.velocity,
      planes: input.planes,
    }) * recencyWeight(input.ageHours, input.windowHours ?? 24)
  );
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

function defaultEvidence(item: HighlightItem): PlaneEvidence[] {
  if (item.evidence?.length) return item.evidence;
  return item.sources.map((s) => ({
    plane: item.tripwire ? ("tripwire" as const) : ("rss" as const),
    source: s.name,
    url: s.url,
    firstSeen: s.firstSeen || item.publishedAt,
  }));
}

export function enrichItemHeat(
  item: HighlightItem,
  now = Date.now(),
  windowHours = 24,
): HighlightItem {
  const evidence = defaultEvidence(item);
  const firstSeens = evidence
    .map((e) => e.firstSeen || item.publishedAt)
    .filter(Boolean) as string[];
  const firstSeen = firstSeens.reduce((a, b) =>
    new Date(a).getTime() <= new Date(b).getTime() ? a : b
  );
  processBootAt();
  const breadth = weightedBreadth(evidence);
  const velocity = computeWeightedVelocity(evidence, now);
  const ageHours = Math.max(
    0,
    (now - new Date(item.publishedAt).getTime()) / HOUR_MS
  );
  const planes = planesPresent(evidence);
  const baseHeat = storyBaseHeat({ breadth, velocity, planes });
  const heat = baseHeat * recencyWeight(ageHours, windowHours);
  const rssCount = evidence.filter(
    (e) => e.plane === "rss" || e.plane === "tripwire"
  ).length;

  return {
    ...item,
    evidence,
    heat,
    baseHeat,
    velocity,
    firstSeen,
    hot: item.hot || rssCount >= 2 || item.tripwire === true,
    socialLed:
      item.socialLed ??
      (item.signalState === "early" || item.signalState === "building"),
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
  const topBreadth = top ? weightedBreadth(defaultEvidence(top)) : 0;

  const shouldPersist =
    opts?.persistHistory ??
    (process.env.PW_TEST !== "1" || process.env.PW_HISTORY === "1");
  if (shouldPersist) {
    writeHistorySample({
      section,
      sectionRaw: raw,
      clusterCount: enriched.length,
      topBreadth: Math.round(topBreadth),
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
    const times = defaultEvidence(top)
      .map((e) => new Date(e.firstSeen || top.publishedAt).getTime())
      .filter((t) => Number.isFinite(t))
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
    socialLed: Boolean(top?.socialLed),
    topSignalState: top?.signalState,
    topTripwire: Boolean(top?.tripwire),
    sectionRaw: raw,
  };
}

export function describeScore(score: SectionScore): string {
  return `${sectionLabel(score.section)} ${score.score}`;
}
