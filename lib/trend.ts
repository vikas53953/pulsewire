import type { SocialSignal } from "./fusion";
import type {
  ContentSectionId,
  HighlightItem,
  SectionId,
  TrendItem,
  TrendPack,
  TrendPlane,
} from "./types";

const TREND_PER_PLANE = 5;

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

function wiresFromItems(
  items: HighlightItem[],
  section: SectionId,
): TrendItem[] {
  const filtered =
    section === "all"
      ? items
      : items.filter((i) => !i.section || i.section === section);

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
        item.section && item.section !== "xpulse" && item.section !== "vibe" && item.section !== "radar"
          ? (item.section as ContentSectionId)
          : undefined,
      ),
    );
    if (out.length >= TREND_PER_PLANE) break;
  }
  return out;
}

function socialToTrend(
  signals: SocialSignal[],
  plane: "reddit" | "x",
  section: SectionId,
): TrendItem[] {
  const filtered =
    section === "all"
      ? signals.filter((s) => s.plane === plane)
      : signals.filter(
          (s) =>
            s.plane === plane &&
            (!s.section || s.section === section),
        );

  // If section filter emptied the list, fall back to all of that plane
  // so the strip never looks dead while social is live elsewhere.
  const pool =
    filtered.length > 0
      ? filtered
      : signals.filter((s) => s.plane === plane);

  const sorted = [...pool].sort(
    (a, b) => (b.velocity ?? 0) - (a.velocity ?? 0),
  );
  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const sig of sorted) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      toTrendItem(
        sig.title,
        sig.url,
        sig.source,
        sig.publishedAt,
        plane,
        sig.section,
      ),
    );
    if (out.length >= TREND_PER_PLANE) break;
  }
  return out;
}

function planeStatus(
  items: TrendItem[],
  emptyNote: string,
): TrendPlane {
  if (items.length === 0) {
    return { status: "quiet", items: [], note: emptyNote };
  }
  return { status: "ok", items, note: null };
}

/**
 * Always-visible mix: On wires · On Reddit · On X for the active section.
 * Does not require title-match fusion — shows what each plane is fetching.
 */
export function buildTrendPack(input: {
  section: SectionId;
  items: HighlightItem[];
  reddit: SocialSignal[];
  x: SocialSignal[];
}): TrendPack {
  const wires = wiresFromItems(input.items, input.section);
  const reddit = socialToTrend(input.reddit, "reddit", input.section);
  const x = socialToTrend(input.x, "x", input.section);

  return {
    wires: planeStatus(wires, "Quiet on wires in this window."),
    reddit: planeStatus(reddit, "Quiet on Reddit — fetched, nothing loud."),
    x: planeStatus(x, "Quiet on X — no earned/cached pulse yet."),
  };
}
