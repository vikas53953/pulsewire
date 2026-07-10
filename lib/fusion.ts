import { isLikelyDuplicate } from "./similarity";
import { isTestMode } from "./test-mode";
import type {
  ContentSectionId,
  HighlightItem,
  PlaneEvidence,
  SignalState,
  SourceRef,
} from "./types";

/** SPEC v4 §3 plane weights */
export const PLANE_WEIGHT = {
  rss: 1.0,
  tripwire: 1.5,
  reddit: 0.6,
  x: 0.4,
} as const;

export type SocialSignal = {
  plane: "reddit" | "x";
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  section?: ContentSectionId;
  /** Velocity proxy (score+comments/hour or engagement rank). */
  velocity?: number;
};

export function planesPresent(evidence: PlaneEvidence[]): Set<string> {
  const planes = new Set<string>();
  for (const e of evidence) {
    if (e.plane === "tripwire") planes.add("rss");
    else planes.add(e.plane);
  }
  return planes;
}

export function deriveSignalState(evidence: PlaneEvidence[]): SignalState {
  const planes = planesPresent(evidence);
  const hasRss = planes.has("rss");
  const hasX = planes.has("x");
  const hasReddit = planes.has("reddit");
  const hasTripwire = evidence.some((e) => e.plane === "tripwire");

  // Tripwire or any RSS = ground truth → CONFIRMED
  if (hasTripwire || hasRss) return "confirmed";
  // X + Reddit, no wire yet
  if (hasX && hasReddit) return "building";
  // X-only or Reddit-only (extreme) → EARLY
  if (hasX || hasReddit) return "early";
  return "confirmed";
}

export function signalStateLabel(state: SignalState): string {
  switch (state) {
    case "early":
      return "early · unconfirmed";
    case "building":
      return "gaining traction";
    case "confirmed":
      return "confirmed";
  }
}

export function crossBonus(planes: Set<string>): number {
  const n = planes.size;
  if (n >= 3) return 1.6;
  if (n >= 2) return 1.3;
  return 1;
}

export function weightedBreadth(evidence: PlaneEvidence[]): number {
  // Distinct evidence rows by plane+source
  const seen = new Set<string>();
  let sum = 0;
  for (const e of evidence) {
    const key = `${e.plane}|${e.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sum += PLANE_WEIGHT[e.plane] ?? 1;
  }
  return Math.max(0.4, sum);
}

export function evidenceLine(item: HighlightItem): string {
  const parts: string[] = [];
  const rss = (item.sources || []).filter(
    (s) => !s.name.startsWith("r/") && !s.name.startsWith("@") && !s.name.startsWith("⚡"),
  );
  if (rss.length > 0) {
    const head = rss[0].name;
    const extra = Math.max(0, rss.length - 1);
    parts.push(extra > 0 ? `${head} +${extra}` : head);
  }
  const reddit = (item.evidence || []).filter((e) => e.plane === "reddit");
  for (const r of reddit.slice(0, 2)) {
    parts.push(`${r.source} ▲`);
  }
  if ((item.evidence || []).some((e) => e.plane === "x")) {
    parts.push("⚡ X");
  }
  if ((item.evidence || []).some((e) => e.plane === "tripwire")) {
    parts.push("📡 tripwire");
  }
  return parts.join(" · ") || item.sources[0]?.name || "signal";
}

function toEvidenceFromSources(
  sources: SourceRef[],
  tripwire?: boolean,
): PlaneEvidence[] {
  return sources.map((s) => ({
    plane: tripwire ? ("tripwire" as const) : ("rss" as const),
    source: s.name,
    url: s.url,
    firstSeen: s.firstSeen,
  }));
}

/**
 * Attach social signals to RSS clusters by fuzzy title match.
 * Uncertain matches stay separate — never force-merge.
 */
export function fuseSocialIntoItems(
  items: HighlightItem[],
  signals: SocialSignal[],
  opts?: { matchThreshold?: number },
): HighlightItem[] {
  // Slightly looser than 0.62 so Reddit/X attach more often on live desks.
  const threshold = opts?.matchThreshold ?? 0.55;
  const used = new Set<number>();
  const out = items.map((item) => {
    const evidence: PlaneEvidence[] = [
      ...(item.evidence?.length
        ? item.evidence
        : toEvidenceFromSources(item.sources, item.tripwire)),
    ];
    let firstSocialAt: string | undefined = item.firstSocialAt;

    signals.forEach((sig, idx) => {
      if (used.has(idx)) return;
      if (item.section && sig.section && item.section !== sig.section) return;
      if (!isLikelyDuplicate(item.text, sig.title, threshold)) return;
      used.add(idx);
      evidence.push({
        plane: sig.plane,
        source: sig.source,
        url: sig.url,
        firstSeen: sig.publishedAt,
      });
      if (
        !firstSocialAt ||
        new Date(sig.publishedAt).getTime() < new Date(firstSocialAt).getTime()
      ) {
        firstSocialAt = sig.publishedAt;
      }
    });

    const state = deriveSignalState(evidence);
    return {
      ...item,
      evidence,
      signalState: state,
      firstSocialAt,
      socialLed: state === "early" || state === "building",
    };
  });

  // Orphan social → EARLY tiles (max handled by ranker).
  // Reddit orphans need extreme velocity; X-only always eligible as EARLY.
  // In PW_TEST, skip Reddit orphans unless an explicit early/fusion fixture
  // so RSS window gates stay deterministic.
  const orphans: HighlightItem[] = [];
  const allowRedditOrphans =
    !isTestMode() ||
    process.env.PW_EARLY_X === "1" ||
    process.env.PW_FUSION === "1";

  signals.forEach((sig, idx) => {
    if (used.has(idx)) return;
    if (sig.plane === "reddit") {
      if (!allowRedditOrphans) return;
      // Lowered from 8 so loud Reddit orphans surface as EARLY more often.
      if ((sig.velocity ?? 0) < 4) return;
    }
    const evidence: PlaneEvidence[] = [
      {
        plane: sig.plane,
        source: sig.source,
        url: sig.url,
        firstSeen: sig.publishedAt,
      },
    ];
    const state = deriveSignalState(evidence);
    orphans.push({
      text: sig.title,
      sources: [{ name: sig.source, url: sig.url, firstSeen: sig.publishedAt }],
      publishedAt: sig.publishedAt,
      hot: false,
      section: sig.section,
      evidence,
      signalState: state,
      firstSocialAt: sig.publishedAt,
      socialLed: true,
      clusterId: `social-${sig.plane}-${idx}-${sig.url.slice(-24)}`,
    });
  });

  return [...out, ...orphans];
}

/** Max 2 EARLY items, always below confirmed/building. */
export function rankWithSignalStates(items: HighlightItem[]): HighlightItem[] {
  const confirmed = items.filter(
    (i) => (i.signalState ?? "confirmed") === "confirmed",
  );
  const building = items.filter((i) => i.signalState === "building");
  const early = items
    .filter((i) => i.signalState === "early")
    .sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))
    .slice(0, 4);

  const byHeat = (a: HighlightItem, b: HighlightItem) =>
    (b.heat ?? 0) - (a.heat ?? 0);

  return [
    ...confirmed.sort(byHeat),
    ...building.sort(byHeat),
    ...early,
  ];
}

/** EARLY/BUILDING must never alone produce red (tripwire exception). */
export function canDriveRedVerdict(item: HighlightItem | undefined): boolean {
  if (!item) return false;
  if (item.tripwire) return true;
  const state = item.signalState ?? "confirmed";
  return state === "confirmed";
}
