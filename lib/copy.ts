import type { SectionScore, TrafficLevel } from "./types";
import { sectionLabel } from "./types";
import { istBucketParts, readBucketSamples } from "./history";
import { quietDeskWhyLine } from "./quiet-receipts";

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
  const breadth =
    score.topBreadth != null && score.topBreadth >= 1
      ? Math.round(score.topBreadth)
      : null;
  const sources =
    breadth == null ? null : breadth === 1 ? "1 source" : `${breadth} sources`;
  const age =
    score.topSpanMinutes != null
      ? ` · span ${score.topSpanMinutes}m`
      : "";

  if (score.socialLed || score.topSignalState === "early") {
    return topic
      ? `${label} ${score.score}${levelGlyph(score.level)} — driven by: ${topic} (social-led, unconfirmed)`
      : `${label}: social-led heat — waiting on wire confirmation.`;
  }

  if (topic) {
    const receipt = sources
      ? ` (${sources}${age})`
      : age
        ? ` (${age.replace(/^ · /, "")})`
        : "";
    return `${label} ${score.score}${levelGlyph(score.level)} — driven by: ${topic}${receipt}.`;
  }

  if (score.calibrating) {
    return `${label}: calibrating baseline (${score.score}/100) — no standout cluster yet.`;
  }

  // D1: earned quiet receipt when history supports it
  if (score.level === "green" && score.sectionRaw != null) {
    const at = new Date();
    const { hourIst, weekdayIst } = istBucketParts(at);
    const samples = readBucketSamples(score.section, hourIst, weekdayIst);
    const earned = quietDeskWhyLine(score, score.sectionRaw, samples, at);
    if (earned) return earned;
  }

  return `${label} quiet (${score.score}/100) — below the warming threshold.`;
}
