import {
  eightWords,
  trafficLevel,
} from "./score";
import type {
  ContentSectionId,
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
}

function byLevel(scores: SectionScore[], level: TrafficLevel): SectionScore[] {
  return scores
    .filter((s) => s.level === level)
    .sort((a, b) => b.score - a.score);
}

/**
 * Deterministic verdict templates (SPEC v2 §3).
 * LLM may polish later but must never invent the verdict.
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

  const reds = byLevel(ctx.scores, "red");
  const yellows = byLevel(ctx.scores, "yellow");
  const greens = byLevel(ctx.scores, "green");

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
    const breadth = s.topBreadth ?? s.topVelocity ?? 2;
    const span = s.topSpanMinutes ?? 40;
    return {
      text: `🔴 ${sectionLabel(s.section)} is hot — ${story}, ${breadth} sources in ${span} min.`,
      level: "red",
      llmPolished: false,
    };
  }

  if (yellows.length === 1 && reds.length === 0) {
    const s = yellows[0];
    const story = eightWords(s.topText ?? "developing story");
    // "one 🟡, rest 🟢" — if multiple yellow, still lead with hottest yellow
    if (yellows.length === 1 || greens.length + yellows.length === ctx.scores.length) {
      return {
        text: `Mostly quiet. ${sectionLabel(s.section)} is warming up — ${story}.`,
        level: "yellow",
        llmPolished: false,
      };
    }
  }

  if (yellows.length >= 1 && reds.length === 0) {
    const s = yellows[0];
    const story = eightWords(s.topText ?? "developing story");
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
    // Must still mention a traffic signal word or keep structure — soft check
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
