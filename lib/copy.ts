import type { SectionScore, TrafficLevel } from "./types";
import { sectionLabel } from "./types";

/** Short topic for chip/why lines — complete words, no mid-sentence ellipsis. */
export function shortEvent(text: string, maxWords = 10): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[…]+/g, "")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  const slice = words.slice(0, maxWords);
  const joined = slice.join(" ");
  const soft = joined.match(/^(.+[,:;])\s+\S+/);
  if (soft && soft[1].split(" ").length >= 4) return soft[1].replace(/[,:;]$/, "");
  return slice.join(" ");
}

/** @deprecated Prefer shortEvent — kept for call sites that expect ≤8 words. */
export function eightWords(text: string): string {
  return shortEvent(text, 8);
}

function levelGlyph(level: TrafficLevel): string {
  if (level === "red") return "🔴";
  if (level === "yellow") return "🟡";
  return "🟢";
}

/** One-line “why this desk moved” — names the driver, not the score. */
export function pulseWhy(score: SectionScore): string {
  const label = sectionLabel(score.section);
  if (score.unknown) {
    return `${label}: sources unreachable — status unknown (not quiet).`;
  }
  const topic = score.topText ? shortEvent(score.topText, 10) : null;
  // "N sources" = independent publishers only (never weighted breadth).
  const publishers =
    score.topPublisherCount != null && score.topPublisherCount >= 1
      ? Math.round(score.topPublisherCount)
      : null;
  const sources =
    publishers == null
      ? null
      : publishers === 1
        ? "1 source"
        : `${publishers} sources`;
  const age =
    score.topSpanMinutes != null
      ? ` · span ${score.topSpanMinutes}m`
      : "";
  const scoreLabel = `${score.score}${score.calibrating ? "·c" : ""}${levelGlyph(score.level)}`;
  const baselineProgress = score.calibrating
    ? ` · provisional, ${score.baselineSampleCount ?? 0}/${score.baselineRequired ?? 14} baseline samples`
    : "";

  if (score.socialLed || score.topSignalState === "early") {
    return topic
      ? `${label} ${scoreLabel} — driven by: ${topic} (social-led, unconfirmed)`
      : `${label}: social-led heat — waiting on wire confirmation.`;
  }

  if (topic) {
    const receipt = sources
      ? ` (${sources}${age})`
      : age
        ? ` (${age.replace(/^ · /, "")})`
        : "";
    return `${label} ${scoreLabel} — driven by: ${topic}${receipt}${baselineProgress}.`;
  }

  if (score.calibrating) {
    return `${label}: ${score.score}·c provisional — ${score.baselineSampleCount ?? 0}/${score.baselineRequired ?? 14} baseline samples; no standout cluster yet.`;
  }

  // D1: server-computed quiet receipt (never import history on the client)
  if (score.quietWhy) return score.quietWhy;

  return `${label} quiet (${score.score}/100) — below the warming threshold.`;
}
