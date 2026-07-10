import type { SectionScore } from "./types";
import { sectionLabel } from "./types";

/** Shorten a headline to ~8 words (verdict / chip copy). */
export function eightWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 8) return words.join(" ");
  return `${words.slice(0, 8).join(" ")}…`;
}

/** One-line “why this desk moved” for chip hover/focus (client-safe). */
export function pulseWhy(score: SectionScore): string {
  const label = sectionLabel(score.section);
  if (score.calibrating) {
    return `${label}: still calibrating against a normal hour (${score.score}/100).`;
  }
  if (score.socialLed || score.topSignalState === "early") {
    return `${label}: social-led heat at ${score.score}/100 — waiting on wire confirmation.`;
  }
  const topic = eightWords(score.topText ?? "no standout cluster");
  const n = Math.max(1, Math.round(score.topBreadth ?? score.topVelocity ?? 1));
  const sources = n === 1 ? "1 source" : `${n} sources`;
  if (score.level === "red") {
    return `${label} hot (${score.score}): ${topic} · ${sources} in ${score.topSpanMinutes ?? "?"} min.`;
  }
  if (score.level === "yellow") {
    return `${label} warming (${score.score}): ${topic} · ${sources}.`;
  }
  return `${label} quiet (${score.score}/100) — below the warming threshold.`;
}
