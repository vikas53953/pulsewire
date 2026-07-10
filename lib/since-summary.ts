import type { ContentSectionId, HighlightItem, SectionScore } from "./types";
import { SCORE_CHIP_ORDER, sectionLabel } from "./types";

const CONTENT_SECTIONS = new Set<string>(SCORE_CHIP_ORDER);

function asContentSection(sec: string | undefined): ContentSectionId | null {
  if (!sec || !CONTENT_SECTIONS.has(sec)) return null;
  return sec as ContentSectionId;
}

/**
 * One synthesized line for the since-lens board.
 * Returns null when nothing changed (caller keeps existing empty verdict).
 */
export function buildSinceSummaryLine(input: {
  scores: SectionScore[];
  /** Scores from the previous visit snapshot, if known (optional). */
  previousScores?: Array<Pick<SectionScore, "section" | "score" | "level">>;
  items: HighlightItem[];
}): string | null {
  const { scores, items, previousScores } = input;
  if (items.length === 0) return null;

  const prevMap = new Map(
    (previousScores || []).map((s) => [s.section, s] as const),
  );
  const bits: string[] = [];

  // Prefer desks that moved or have new stories
  const bySection = new Map<ContentSectionId, HighlightItem[]>();
  for (const item of items) {
    const sec = asContentSection(item.section);
    if (!sec) continue;
    const list = bySection.get(sec) || [];
    list.push(item);
    bySection.set(sec, list);
  }

  const ordered = [...scores].sort((a, b) => b.score - a.score);
  for (const s of ordered) {
    if (bits.length >= 3) break;
    const prev = prevMap.get(s.section);
    const newCount = bySection.get(s.section)?.length ?? 0;
    const label = sectionLabel(s.section);

    if (prev && prev.score !== s.score) {
      const cooled = s.score < prev.score && s.level === "green";
      if (cooled && newCount === 0) {
        bits.push(`${label} cooled`);
      } else {
        const storyBit =
          newCount > 0
            ? `, ${newCount} new ${newCount === 1 ? "story" : "stories"}`
            : "";
        bits.push(`${label} ${prev.score}→${s.score}${storyBit}`);
      }
      continue;
    }

    if (newCount > 0) {
      bits.push(
        `${label}: ${newCount} new ${newCount === 1 ? "story" : "stories"}`,
      );
    }
  }

  if (bits.length === 0) {
    // Fallback: count new stories without score delta
    const n = items.length;
    bits.push(`${n} new ${n === 1 ? "story" : "stories"}`);
  }

  return `Since you left: ${bits.join("; ")}.`;
}
