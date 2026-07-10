import {
  canDriveRedVerdict,
} from "./fusion";
import { shortEvent } from "./copy";
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
  /** Blind ≠ quiet — feeds unreachable. */
  sourcesUnreachable?: boolean;
  /** ISO of last successful board build, if known. */
  lastConfirmedAt?: string;
}

const WHY_DESKS = new Set<ContentSectionId>([
  "markets",
  "economy",
  "politics",
]);

function byLevel(scores: SectionScore[], level: TrafficLevel): SectionScore[] {
  return scores
    .filter((s) => !s.unknown && s.level === level)
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

/** Real source breadth only — never substitute velocity (that lied as "sources"). */
function sourceCount(s: SectionScore): number | null {
  const n = s.topBreadth;
  if (n == null || !Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

function sourcesClause(s: SectionScore): string {
  const n = sourceCount(s);
  if (n == null) return "";
  return n === 1 ? " (1 source)" : ` (${n} sources)`;
}

function eventPhrase(s: SectionScore): string {
  return shortEvent(s.topText ?? "a developing cluster", 10);
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
  if (names.length === 1) return `${names[0]} normal`;
  return `${names[0]} & ${names[1]} normal`;
}

/**
 * Why-it-matters: consequence / what to watch — never restate the pulse number.
 */
export function verdictWhy(s: SectionScore | null | undefined): string | null {
  if (!s || s.unknown || s.level === "green") return null;
  if (!WHY_DESKS.has(s.section)) return null;
  const event = eventPhrase(s);
  const n = sourceCount(s);
  if (s.socialLed || s.topSignalState === "early") {
    return `Watch: ${event} is loud on social with no wire confirmation yet — do not act on it alone.`;
  }
  if (s.level === "red") {
    return n != null
      ? `Watch: ${event} has ${n} sources moving fast — check the ${sectionLabel(s.section)} desk before your next move.`
      : `Watch: ${event} is moving fast — check the ${sectionLabel(s.section)} desk before your next move.`;
  }
  return n != null
    ? `Watch: ${event} is lifting ${sectionLabel(s.section)} above a normal hour (${n} sources).`
    : `Watch: ${event} is lifting ${sectionLabel(s.section)} above a normal hour.`;
}

function blindVerdict(ctx: VerdictContext): VerdictPayload {
  let ago = "";
  if (ctx.lastConfirmedAt) {
    const mins = Math.max(
      0,
      Math.round((Date.now() - Date.parse(ctx.lastConfirmedAt)) / 60_000),
    );
    if (Number.isFinite(mins)) {
      ago =
        mins < 1
          ? " (last confirmed just now)"
          : mins < 60
            ? ` (last confirmed ${mins}m ago)`
            : ` (last confirmed ${Math.round(mins / 60)}h ago)`;
    }
  }
  return {
    text: `Sources unreachable${ago} — status unknown, not quiet. Do not treat this as an all-clear.`,
    level: "yellow",
    llmPolished: false,
    why: "Blind is not quiet. Fix connectivity or wait for feeds before trusting the board.",
    blind: true,
  };
}

/**
 * Deterministic verdict templates (SPEC v2 §3 + v4 fusion rules).
 * Status judgment in our own words — never paste a truncated wire headline.
 * EARLY never drives red alone — max yellow "brewing".
 * Blind ≠ quiet.
 */
export function buildVerdictTemplate(ctx: VerdictContext): VerdictPayload {
  if (ctx.sourcesUnreachable) {
    return blindVerdict(ctx);
  }

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
      text: `Busy: ${sectionLabel(a.section)} and ${sectionLabel(b.section)} both hot. Start with ${sectionLabel(a.section)} — ${eventPhrase(a)}.`,
      level: "red",
      llmPolished: false,
      why: verdictWhy(a),
    };
  }

  if (reds.length === 1) {
    const s = reds[0];
    const calm = calmDesksPhrase(greens);
    const calmBit = calm ? ` ${calm}.` : "";
    return {
      text: `${sectionLabel(s.section)} hot: ${eventPhrase(s)}${sourcesClause(s)}.${calmBit}`,
      level: "red",
      llmPolished: false,
      why: verdictWhy(s),
    };
  }

  const brewing =
    brewingFromFakeRed[0] ||
    yellows.find((s) => s.socialLed || s.topSignalState === "early") ||
    null;
  if (brewing && reds.length === 0) {
    const calm = calmDesksPhrase(greens);
    const lead = calm ? `Mostly quiet. ${calm}.` : "Mostly quiet.";
    return {
      text: `${lead} ${sectionLabel(brewing.section)} brewing on social — no wire confirmation yet.`,
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
        text: `${lead} ${sectionLabel(s.section)} brewing on social — no wire confirmation yet.`,
        level: "yellow",
        llmPolished: false,
        why: verdictWhy(s),
      };
    }
    const calm = calmDesksPhrase(greens.filter((g) => g.section !== s.section));
    const parts = ["Mostly quiet."];
    if (calm) parts.push(`${calm}.`);
    parts.push(
      `${sectionLabel(s.section)} warming: ${eventPhrase(s)}${sourcesClause(s)}.`,
    );
    if (yellows.length >= 2) {
      const second = yellows[1];
      parts.push(
        `${sectionLabel(second.section)} also warming: ${eventPhrase(second)}.`,
      );
    }
    return {
      text: parts.join(" ").replace(/\s+/g, " ").trim(),
      level: "yellow",
      llmPolished: false,
      why: verdictWhy(s),
    };
  }

  return {
    text: "All quiet across every desk. Nothing needs you right now.",
    level: "green",
    llmPolished: false,
  };
}

/** Optional LLM polish — preserve section names, counts, color. Cap 160. */
export async function polishVerdict(
  template: VerdictPayload,
  polishFn?: (text: string) => Promise<string | null>
): Promise<VerdictPayload> {
  if (!polishFn || template.blind) return template;
  try {
    const polished = await polishFn(template.text);
    if (!polished) return template;
    const clipped = polished.trim().slice(0, 160);
    return {
      text: clipped || template.text,
      level: template.level,
      llmPolished: true,
      why: template.why,
      blind: template.blind,
    };
  } catch {
    return template;
  }
}

export function quietTopLine(
  scores: SectionScore[],
  items: { text: string }[]
): string | null {
  if (scores.some((s) => s.unknown)) return null;
  if (trafficLevel(Math.max(0, ...scores.map((s) => s.score))) !== "green") {
    // only for all-quiet hero
  }
  const allGreen = scores.every((s) => s.level === "green");
  if (!allGreen) return null;
  const top = items[0]?.text;
  if (!top) return null;
  return `Top of the quiet: ${shortEvent(top, 12)}`;
}

export type { ContentSectionId };
