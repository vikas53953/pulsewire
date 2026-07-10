import {
  canDriveRedVerdict,
} from "./fusion";
import {
  eightWords,
  trafficLevel,
} from "./score";
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

/**
 * Deterministic verdict templates (SPEC v2 §3 + v4 fusion rules).
 * EARLY never drives red alone — max yellow "brewing".
 * Tripwire exception: official source = confirmed.
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
    };
  }

  if (reds.length === 1) {
    const s = reds[0];
    const story = eightWords(s.topText ?? "breaking story");
    const breadth = Math.round(s.topBreadth ?? s.topVelocity ?? 2);
    const span = s.topSpanMinutes ?? 40;
    return {
      text: `🔴 ${sectionLabel(s.section)} is hot — ${story}, ${breadth} sources in ${span} min.`,
      level: "red",
      llmPolished: false,
    };
  }

  // Brewing template — yellow max (EARLY social heat)
  const brewing =
    brewingFromFakeRed[0] ||
    yellows.find((s) => s.socialLed || s.topSignalState === "early") ||
    null;
  if (brewing && reds.length === 0) {
    return {
      text: `Something's brewing in ${sectionLabel(brewing.section)} — loud on X, no wire confirmation yet.`,
      level: "yellow",
      llmPolished: false,
    };
  }

  if (yellows.length >= 1 && reds.length === 0) {
    const s = yellows[0];
    const story = eightWords(s.topText ?? "developing story");
    if (s.socialLed || s.topSignalState === "early") {
      return {
        text: `Something's brewing in ${sectionLabel(s.section)} — loud on X, no wire confirmation yet.`,
        level: "yellow",
        llmPolished: false,
      };
    }
    if (yellows.length === 1 || greens.length + yellows.length === ctx.scores.length) {
      return {
        text: `Mostly quiet. ${sectionLabel(s.section)} is warming up — ${story}.`,
        level: "yellow",
        llmPolished: false,
      };
    }
    return {
      text: `Mostly quiet. ${sectionLabel(s.section)} is warming up — ${story}.`,
      level: "yellow",
      llmPolished: false,
    };
  }

  return {
    text: "All quiet. Nothing needs you right now.",
    level: "green",
    llmPolished: false,
  };
}

/** Optional LLM polish — preserve section names, counts, color. Cap 140. */
export async function polishVerdict(
  template: VerdictPayload,
  polishFn?: (text: string) => Promise<string | null>
): Promise<VerdictPayload> {
  if (!polishFn) return template;
  try {
    const polished = await polishFn(template.text);
    if (!polished) return template;
    const clipped = polished.trim().slice(0, 140);
    return {
      text: clipped || template.text,
      level: template.level,
      llmPolished: true,
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
