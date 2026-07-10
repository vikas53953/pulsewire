import type { VerdictPayload } from "./types";

/** One row in a press/listing feed — identified by stable id/URL, never page hash. */
export type RadarListItem = {
  id: string;
  title: string;
  link: string;
};

/**
 * Pure tripwire logic (BUG-V2):
 * - Compare item IDs/URLs, never page hashes / timestamps / ads.
 * - Same ids with "page noise" changed → no trip.
 * - New id with extractable title → trip carrying that headline.
 * - New id without title → skip (caller logs); do not trip.
 */
export function detectNewRssItems(
  previous: RadarListItem[],
  current: RadarListItem[],
): { newItems: RadarListItem[]; skippedUntitled: RadarListItem[] } {
  const prev = new Set(previous.map((i) => i.id).filter(Boolean));
  const newItems: RadarListItem[] = [];
  const skippedUntitled: RadarListItem[] = [];

  for (const item of current) {
    if (!item.id || prev.has(item.id)) continue;
    const title = (item.title || "").trim();
    if (!title) {
      skippedUntitled.push(item);
      continue;
    }
    newItems.push({ ...item, title });
  }

  return { newItems, skippedUntitled };
}

/** Malformed / content-free trips must never touch the verdict (BUG-V3). */
export function isActionableRadarHeadline(
  title: string,
  sourceName: string,
): boolean {
  const t = title.trim();
  if (t.length < 8) return false;
  if (t.toLowerCase() === sourceName.toLowerCase()) return false;
  if (/changed$/i.test(t)) return false;
  if (/^page (hash|bytes)/i.test(t)) return false;
  // Reject "Name: Name changed" / "RBI press changed" style garbage
  if (new RegExp(`^${escapeRegExp(sourceName)}\\s*(changed|:\\s*${escapeRegExp(sourceName)})`, "i").test(t)) {
    return false;
  }
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function radarVerdictFromTrips(
  trips: { name: string; title: string }[],
): VerdictPayload | null {
  const actionable = trips.filter((t) =>
    isActionableRadarHeadline(t.title, t.name),
  );
  if (actionable.length === 0) return null;
  const top = actionable[0];
  return {
    text: `🔴 Radar: ${top.name} — ${top.title}`,
    level: "red",
    llmPolished: false,
  };
}
