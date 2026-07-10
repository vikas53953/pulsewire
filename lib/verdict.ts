import {
  canDriveRedVerdict,
} from "./fusion";
import { eightWords } from "./copy";
import { trafficLevel } from "./score";
import type {
  ContentSectionId,
  HighlightItem,
  SectionScore,
  TrafficLevel,
  VerdictPayload,
} from "./types";
import { sectionLabel } from "./types";

export interface VerdictContext {
  scores: SectionScore[];
  lens: "window" | "since";
  /** Relative label like "3h ago" when lens=since and nothing new. */
  sinceRelative?: string;
  /** True when since-lens has zero items. */
  sinceEmpty?: boolean;
  /** Top items per section — used for early-never-red + brewing. */
  topItems?: HighlightItem[];
}

const WHY_DESKS = new Set<ContentSectionId>([
  "markets",
  "economy",
  "politics",
]);

function byLevel(scores: SectionScore[], level: TrafficLevel): SectionScore[] {
  return scores
    .filter((s) => s.level === level)
    .sort((a, b) => b.score - a.score);
}

function topItemFor(
  section: ContentSectionId,
  items: HighlightItem[] | undefined,
): HighlightItem | undefined {
  if (!items?.length) return undefined;
  return items
    .filter((i) => !i.section || i.section === section)
    .sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0];
}

function shortTopic(text: string | undefined): string {
  return eightWords(text ?? "developing story");
}

function sourceCount(s: SectionScore): number {
  return Math.max(1, Math.round(s.topBreadth ?? s.topVelocity ?? 1));
}

function sourcesPhrase(s: SectionScore): string {
  const n = sourceCount(s);
  return n === 1 ? "1 credible source" : `${n} credible sources`;
}

/** Name up to two calm desks for a status-style verdict (not a teaser). */
function calmDesksPhrase(greens: SectionScore[]): string | null {
  if (greens.length === 0) return null;
  const priority: ContentSectionId[] = [
    "markets",
    "politics",
    "economy",
    "india",
  ];
  const preferred = priority
    .map((id) => greens.find((g) => g.section === id))
    .filter((s): s is SectionScore => Boolean(s));
  const rest = greens
    .filter((g) => !preferred.some((p) => p.section === g.section))
    .sort((a, b) => a.score - b.score);
  const picked = [...preferred, ...rest].slice(0, 2);
  const names = picked.map((s) => sectionLabel(s.section));
  if (names.length === 1) return `${names[0]} calm`;
  return `${names[0]} & ${names[1]} calm`;
}

function warmingClause(s: SectionScore): string {
  const topic = shortTopic(s.topText);
  return `${sectionLabel(s.section)} warming on ${topic} (${sourcesPhrase(s)})`;
}

/** Why-it-matters for desks busy India pros actually act on. */
export function verdictWhy(s: SectionScore | null | undefined): string | null {
  if (!s || s.level === "green") return null;
  if (!WHY_DESKS.has(s.section)) return null;
  if (s.socialLed || s.topSignalState === "early") {
    return "Why it matters: social heat ahead of wires — wait for confirmation before acting.";
  }
  const n = sourceCount(s);
  const span = s.topSpanMinutes ?? 40;
  if (s.level === "red") {
    return `Why it matters: ${sectionLabel(s.section)} is hot with ${n} sources in ${span} min.`;
  }
  return `Why it matters: ${sectionLabel(s.section)} pulse ${s.score} — louder than a normal hour (${n} sources).`;
}

/**
 * Deterministic verdict templates (SPEC v2 §3 + v4 fusion rules).
 * Soft-ship+: synthesize multi-desk status, not a single-story teaser.
 * EARLY never drives red alone — max yellow "brewing".
 */
export function buildVerdictTemplate(ctx: VerdictContext): VerdictPayload {
  if (ctx.lens === "since" && ctx.sinceEmpty) {
    const rel = ctx.sinceRelative ?? "a while";
    return {
      text: `Nothing changed since you left (${rel}). Go live your life.`,
      level: "green",
      llmPolished: false,
    };
  }

  let reds = byLevel(ctx.scores, "red");
  const yellows = byLevel(ctx.scores, "yellow");
  const greens = byLevel(ctx.scores, "green");

  // SPEC v4: demote reds whose top cluster is EARLY/BUILDING (unless tripwire)
  const confirmedReds: SectionScore[] = [];
  const brewingFromFakeRed: SectionScore[] = [];
  for (const s of reds) {
    const top = topItemFor(s.section, ctx.topItems);
    const state = top?.signalState ?? s.topSignalState ?? "confirmed";
    const trip = Boolean(top?.tripwire || s.topTripwire);
    if (trip || state === "confirmed") {
      confirmedReds.push(s);
    } else if (state === "early" || state === "building" || s.socialLed) {
      brewingFromFakeRed.push(s);
    } else if (!top || canDriveRedVerdict(top)) {
      confirmedReds.push(s);
    } else {
      brewingFromFakeRed.push(s);
    }
  }
  reds = confirmedReds;

  if (reds.length >= 2) {
    const a = reds[0];
    const b = reds[1];
    return {
      text: `🔴 Busy: ${sectionLabel(a.section)} and ${sectionLabel(b.section)} both moving. Start with ${sectionLabel(a.section)}.`,
      level: "red",
      llmPolished: false,
      why: verdictWhy(a),
    };
  }

  if (reds.length === 1) {
    const s = reds[0];
    const story = shortTopic(s.topText);
    const breadth = sourceCount(s);
    const span = s.topSpanMinutes ?? 40;
    const calm = calmDesksPhrase(greens);
    const calmBit = calm ? ` ${calm}.` : "";
    return {
      text: `🔴 ${sectionLabel(s.section)} is hot — ${story}, ${breadth} sources in ${span} min.${calmBit}`,
      level: "red",
      llmPolished: false,
      why: verdictWhy(s),
    };
  }

  // Brewing template — yellow max (EARLY social heat)
  const brewing =
    brewingFromFakeRed[0] ||
    yellows.find((s) => s.socialLed || s.topSignalState === "early") ||
    null;
  if (brewing && reds.length === 0) {
    const calm = calmDesksPhrase(greens);
    const lead = calm
      ? `Mostly quiet. ${calm}.`
      : "Mostly quiet.";
    return {
      text: `${lead} Something's brewing in ${sectionLabel(brewing.section)} — loud on X, no wire confirmation yet.`,
      level: "yellow",
      llmPolished: false,
      why: verdictWhy(brewing),
    };
  }

  if (yellows.length >= 1 && reds.length === 0) {
    const s = yellows[0];
    if (s.socialLed || s.topSignalState === "early") {
      const calm = calmDesksPhrase(greens);
      const lead = calm ? `Mostly quiet. ${calm}.` : "Mostly quiet.";
      return {
        text: `${lead} Something's brewing in ${sectionLabel(s.section)} — loud on X, no wire confirmation yet.`,
        level: "yellow",
        llmPolished: false,
        why: verdictWhy(s),
      };
    }
    const calm = calmDesksPhrase(greens.filter((g) => g.section !== s.section));
    const parts = ["Mostly quiet."];
    if (calm) parts.push(calm + ".");
    parts.push(warmingClause(s) + ".");
    if (yellows.length >= 2) {
      const second = yellows[1];
      parts.push(
        `${sectionLabel(second.section)} also warming (${sourcesPhrase(second)}).`,
      );
    }
    return {
      text: parts.join(" ").replace(/\s+/g, " ").trim(),
      level: "yellow",
      llmPolished: false,
      why: verdictWhy(s),
    };
  }

  // Quiet is a win — celebrate majority green.
  const deskCount = ctx.scores.length || greens.length;
  if (greens.length >= Math.max(1, deskCount - 0) && yellows.length === 0) {
    return {
      text: "All quiet across every desk. Nothing needs you right now.",
      level: "green",
      llmPolished: false,
    };
  }

  return {
    text: "All quiet. Nothing needs you right now.",
    level: "green",
    llmPolished: false,
  };
}

/** Optional LLM polish — preserve section names, counts, color. Cap 160. */
export async function polishVerdict(
  template: VerdictPayload,
  polishFn?: (text: string) => Promise<string | null>
): Promise<VerdictPayload> {
  if (!polishFn) return template;
  try {
    const polished = await polishFn(template.text);
    if (!polished) return template;
    const clipped = polished.trim().slice(0, 160);
    return {
      text: clipped || template.text,
      level: template.level,
      llmPolished: true,
      why: template.why,
    };
  } catch {
    return template;
  }
}

export function quietTopLine(
  scores: SectionScore[],
  items: { text: string }[]
): string | null {
  if (trafficLevel(Math.max(0, ...scores.map((s) => s.score))) !== "green") {
    // only for all-quiet hero
  }
  const allGreen = scores.every((s) => s.level === "green");
  if (!allGreen) return null;
  const top = items[0]?.text;
  if (!top) return null;
  return `Top of the quiet: ${top}`;
}

export type { ContentSectionId };
