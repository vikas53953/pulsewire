import type { HighlightItem } from "./types";
import { windowToMs, type TimeWindow } from "./types";

/** Earliest source timestamp — keeps older multi-source stories window-correct. */
export function earliestPublishedAt(isos: string[]): string {
  if (isos.length === 0) return new Date().toISOString();
  return isos.reduce((a, b) =>
    new Date(a).getTime() <= new Date(b).getTime() ? a : b
  );
}

function sourceScore(item: HighlightItem): number {
  return item.hot ? item.sources.length : 0;
}

function compareHotThenRecent(a: HighlightItem, b: HighlightItem): number {
  const aSources = sourceScore(a);
  const bSources = sourceScore(b);
  if (aSources !== bSources) return bSources - aSources;
  if (a.hot !== b.hot) return a.hot ? -1 : 1;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

/** Previous tier boundary — used to reserve older-story slots in wider windows. */
function olderThanMs(window: TimeWindow): number | null {
  switch (window) {
    case "1h":
      return null;
    case "4h":
      return windowToMs("1h");
    case "12h":
      return windowToMs("4h");
    case "24h":
      return windowToMs("12h");
  }
}

/**
 * Within a selected window:
 * 1) 🔥 merged by source-count desc
 * 2) then recency
 * Cap applies AFTER the window filter.
 *
 * For windows wider than 1h, reserve up to 3 slots for stories older than the
 * previous tier so 24h visibly differs from 1h even when the last hour is busy
 * and no 🔥 merges exist.
 */
export function rankAndCapForWindow(
  items: HighlightItem[],
  window: TimeWindow,
  maxItems: number,
  now = Date.now()
): HighlightItem[] {
  const maxAge = windowToMs(window);
  const filtered = items.filter((item) => {
    const age = now - new Date(item.publishedAt).getTime();
    return age >= 0 && age <= maxAge;
  });

  filtered.sort(compareHotThenRecent);

  const olderBoundary = olderThanMs(window);
  if (!olderBoundary || filtered.length <= maxItems) {
    return filtered.slice(0, maxItems);
  }

  const older = filtered
    .filter((item) => now - new Date(item.publishedAt).getTime() > olderBoundary)
    .sort(compareHotThenRecent);

  if (older.length === 0) {
    return filtered.slice(0, maxItems);
  }

  const reserve = Math.min(3, Math.floor(maxItems / 3), older.length);
  const recentSlots = maxItems - reserve;
  const head = filtered.slice(0, recentSlots);
  const headKeys = new Set(head.map((i) => `${i.publishedAt}|${i.text}`));
  const tail: HighlightItem[] = [];
  for (const item of older) {
    if (tail.length >= reserve) break;
    const key = `${item.publishedAt}|${item.text}`;
    if (headKeys.has(key)) continue;
    tail.push(item);
  }

  // If we couldn't fill reserve with unique older items, backfill from head pool
  const combined = [...head, ...tail];
  if (combined.length < maxItems) {
    for (const item of filtered) {
      if (combined.length >= maxItems) break;
      const key = `${item.publishedAt}|${item.text}`;
      if (combined.some((c) => `${c.publishedAt}|${c.text}` === key)) continue;
      combined.push(item);
    }
  }

  return combined.slice(0, maxItems);
}
