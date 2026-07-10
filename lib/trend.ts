import { isLikelyDuplicate } from "./similarity";
import type { SocialSignal } from "./fusion";
import type {
  ContentSectionId,
  HighlightItem,
  SectionId,
  TrendItem,
  TrendPack,
  TrendPlane,
} from "./types";
import { sectionLabel } from "./types";

const TREND_PER_PLANE = 3;

function toTrendItem(
  title: string,
  url: string,
  source: string,
  publishedAt: string,
  plane: TrendItem["plane"],
  section?: ContentSectionId,
): TrendItem {
  return { title, url, source, publishedAt, plane, section };
}

function isContentSection(id: SectionId): id is ContentSectionId {
  return (
    id !== "all" &&
    id !== "xpulse" &&
    id !== "vibe" &&
    id !== "radar"
  );
}

/** Reddit/X signal belongs to this desk (no global bleed). */
export function signalMatchesSection(
  sig: SocialSignal,
  section: ContentSectionId,
): boolean {
  if (sig.sections?.includes(section)) return true;
  if (sig.section === section) return true;
  return false;
}

function wiresFromItems(
  items: HighlightItem[],
  section: ContentSectionId,
): TrendItem[] {
  const filtered = items.filter(
    (i) => !i.section || i.section === section,
  );

  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const item of filtered) {
    if ((item.signalState ?? "confirmed") === "early") continue;
    const url = item.sources[0]?.url || "";
    const key = `${item.text}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      toTrendItem(
        item.text,
        url,
        item.sources[0]?.name || "wire",
        item.publishedAt,
        "rss",
        item.section && isContentSection(item.section)
          ? item.section
          : section,
      ),
    );
    if (out.length >= TREND_PER_PLANE) break;
  }
  return out;
}

function redditForSection(
  signals: SocialSignal[],
  section: ContentSectionId,
): TrendItem[] {
  const pool = signals
    .filter((s) => s.plane === "reddit" && signalMatchesSection(s, section))
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));

  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const sig of pool) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      toTrendItem(
        sig.title,
        sig.url,
        sig.source,
        sig.publishedAt,
        "reddit",
        section,
      ),
    );
    if (out.length >= TREND_PER_PLANE) break;
  }
  return out;
}

/**
 * X for a desk: only items tagged for that section, or fuzzy-matched
 * to a wire already on that desk. Never dump the global X feed into every chip.
 */
function xForSection(
  signals: SocialSignal[],
  wires: HighlightItem[],
  section: ContentSectionId,
): TrendItem[] {
  const sectionWires = wires.filter(
    (i) => !i.section || i.section === section,
  );
  const candidates = signals.filter((s) => s.plane === "x");
  const picked: SocialSignal[] = [];
  const seen = new Set<string>();

  for (const sig of candidates) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    if (signalMatchesSection(sig, section)) {
      seen.add(key);
      picked.push(sig);
      continue;
    }
    // Untagged X: only if it clearly matches a wire on this desk
    if (!sig.section && (!sig.sections || sig.sections.length === 0)) {
      const hit = sectionWires.some((w) =>
        isLikelyDuplicate(w.text, sig.title, 0.55),
      );
      if (hit) {
        seen.add(key);
        picked.push(sig);
      }
    }
  }

  picked.sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));
  return picked.slice(0, TREND_PER_PLANE).map((sig) =>
    toTrendItem(
      sig.title,
      sig.url,
      sig.source,
      sig.publishedAt,
      "x",
      section,
    ),
  );
}

function planeStatus(items: TrendItem[], emptyNote: string): TrendPlane {
  if (items.length === 0) {
    return { status: "quiet", items: [], note: emptyNote };
  }
  return { status: "ok", items, note: null };
}

/**
 * Section-scoped mix only. Callers should skip ALL — strip is for a desk chip.
 */
export function buildTrendPack(input: {
  section: SectionId;
  items: HighlightItem[];
  reddit: SocialSignal[];
  x: SocialSignal[];
}): TrendPack | null {
  if (!isContentSection(input.section)) return null;

  const section = input.section;
  const label = sectionLabel(section);
  const wires = wiresFromItems(input.items, section);
  const reddit = redditForSection(input.reddit, section);
  const x = xForSection(input.x, input.items, section);

  return {
    wires: planeStatus(wires, `Quiet on ${label} wires.`),
    reddit: planeStatus(
      reddit,
      `Quiet on Reddit for ${label} — nothing loud in this desk’s subs.`,
    ),
    x: planeStatus(
      x,
      `Quiet on X for ${label} — no matching pulse yet.`,
    ),
  };
}
