import {
  canDriveRedVerdict,
} from "./fusion";
import { shortEvent } from "./copy";
import { isLikelyDuplicate } from "./similarity";
import { trafficLevel } from "./score";
import { allQuietReceiptLine } from "./quiet-receipts";
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
  "india",
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

/** Lead computed from desk mix — never hardcode "Mostly quiet" over all-yellow. */
function statusLead(
  greens: SectionScore[],
  yellows: SectionScore[],
  reds: SectionScore[],
): string {
  if (reds.length >= 2) return "Busy.";
  if (reds.length === 1) return "";
  if (yellows.length === 0) return "All quiet.";
  const known = greens.length + yellows.length;
  if (known === 0) return "Mostly quiet.";
  if (greens.length === 0) {
    return yellows.length >= 3 ? "Broadly warming." : "Warming.";
  }
  if (yellows.length >= greens.length) return "Mixed.";
  return "Mostly quiet.";
}

function sameEvent(a: SectionScore, b: SectionScore): boolean {
  if (!a.topText || !b.topText) return false;
  return isLikelyDuplicate(a.topText, b.topText, 0.72);
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
 * Why-it-matters: action / invalidation only — never restate the event headline
 * (verdict + hero tile already carry the story). Return null when we'd only re-quote.
 */
export function verdictWhy(s: SectionScore | null | undefined): string | null {
  if (!s || s.unknown || s.level === "green") return null;
  if (!WHY_DESKS.has(s.section)) return null;
  const label = sectionLabel(s.section);
  const n = sourceCount(s);

  if (s.socialLed || s.topSignalState === "early") {
    return "Watch: no wire confirmation yet — do not act on social alone.";
  }
  if (s.level === "red") {
    return n != null && n >= 2
      ? `Watch: ${n} sources moving together — open ${label} before your next move.`
      : `Watch: open the ${label} desk before your next move.`;
  }
  // Yellow: invalidation condition — new information, not a headline echo.
  return `Watch: if ${label} cools without a second wave in the next hour, you can ignore it.`;
}

function withDriver(
  payload: VerdictPayload,
  driver: SectionScore | null | undefined,
): VerdictPayload {
  if (!driver) return payload;
  return { ...payload, drivingSection: driver.section };
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
    why: "Blind is not quiet. Feeds are down on our side — last confirmed status is the only safe read until they return.",
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
    return withDriver(
      {
        text: `Busy: ${sectionLabel(a.section)} and ${sectionLabel(b.section)} both hot. Start with ${sectionLabel(a.section)} — ${eventPhrase(a)}.`,
        level: "red",
        llmPolished: false,
        why: verdictWhy(a),
      },
      a,
    );
  }

  if (reds.length === 1) {
    const s = reds[0];
    const calm = calmDesksPhrase(greens);
    const calmBit = calm ? ` ${calm}.` : "";
    return withDriver(
      {
        text: `${sectionLabel(s.section)} hot: ${eventPhrase(s)}${sourcesClause(s)}.${calmBit}`,
        level: "red",
        llmPolished: false,
        why: verdictWhy(s),
      },
      s,
    );
  }

  const brewing =
    brewingFromFakeRed[0] ||
    yellows.find((s) => s.socialLed || s.topSignalState === "early") ||
    null;
  if (brewing && reds.length === 0) {
    const lead = statusLead(greens, yellows, reds);
    const calm = calmDesksPhrase(greens);
    const parts = [lead];
    if (calm) parts.push(`${calm}.`);
    parts.push(
      `${sectionLabel(brewing.section)} brewing on social — no wire confirmation yet.`,
    );
    return withDriver(
      {
        text: parts.join(" ").replace(/\s+/g, " ").trim(),
        level: "yellow",
        llmPolished: false,
        why: verdictWhy(brewing),
      },
      brewing,
    );
  }

  if (yellows.length >= 1 && reds.length === 0) {
    const s = yellows[0];
    const lead = statusLead(greens, yellows, reds);
    if (s.socialLed || s.topSignalState === "early") {
      const calm = calmDesksPhrase(greens);
      const parts = [lead];
      if (calm) parts.push(`${calm}.`);
      parts.push(
        `${sectionLabel(s.section)} brewing on social — no wire confirmation yet.`,
      );
      return withDriver(
        {
          text: parts.join(" ").replace(/\s+/g, " ").trim(),
          level: "yellow",
          llmPolished: false,
          why: verdictWhy(s),
        },
        s,
      );
    }

    const same = yellows.filter((y) => y !== s && sameEvent(s, y));
    const parts = [lead];
    const calm = calmDesksPhrase(greens);
    if (calm) parts.push(`${calm}.`);

    if (same.length > 0) {
      const desks = [s, ...same]
        .slice(0, 3)
        .map((d) => sectionLabel(d.section))
        .join(" & ");
      parts.push(
        `${desks} warming on the same story: ${eventPhrase(s)}${sourcesClause(s)}.`,
      );
      const other = yellows.find(
        (y) => y !== s && !same.some((m) => m.section === y.section),
      );
      if (other) {
        parts.push(
          `${sectionLabel(other.section)} also warming: ${eventPhrase(other)}.`,
        );
      }
    } else {
      parts.push(
        `${sectionLabel(s.section)} warming: ${eventPhrase(s)}${sourcesClause(s)}.`,
      );
      if (yellows.length >= 2) {
        const second = yellows[1];
        if (!sameEvent(s, second)) {
          parts.push(
            `${sectionLabel(second.section)} also warming: ${eventPhrase(second)}.`,
          );
        }
      }
    }

    return withDriver(
      {
        text: parts.join(" ").replace(/\s+/g, " ").trim(),
        level: "yellow",
        llmPolished: false,
        why: verdictWhy(s),
      },
      s,
    );
  }

  const receipt = allQuietReceiptLine(
    greens.length ? greens : scores,
    greens[0]?.section ?? "markets",
    greens[0]?.sectionRaw ?? 0,
  );
  return {
    text: receipt
      ? `All quiet across every desk. Nothing needs you right now. ${receipt}.`
      : "All quiet across every desk. Nothing needs you right now.",
    level: "green",
    llmPolished: false,
    why: receipt,
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
      drivingSection: template.drivingSection,
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
