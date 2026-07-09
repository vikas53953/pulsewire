import { getCache, getMaxItems, setCache, type CacheEntry } from "./cache";
import {
  fetchAllPools,
  fetchSectionPool,
  filterByWindow,
  toRawHighlights,
} from "./feed-engine";
import { CONTENT_SECTIONS } from "./feeds.config";
import type {
  HighlightItem,
  HighlightsResponse,
  RawFeedItem,
  SectionId,
  TimeWindow,
} from "./types";

function buildFromPool(
  section: Exclude<SectionId, "all">,
  pool: RawFeedItem[],
  sourcesUnreachable: boolean
): CacheEntry {
  // M1: raw titles only. M2 will replace with LLM + merge.
  const items = toRawHighlights(pool, Math.max(getMaxItems() * 3, 30)).map(
    (item) => item
  );

  return {
    section,
    generatedAt: new Date().toISOString(),
    items,
    rawMode: true,
    sourcesUnreachable,
    poolCount: pool.length,
  };
}

async function refreshSection(
  section: Exclude<SectionId, "all">
): Promise<CacheEntry> {
  const result = await fetchSectionPool(section);
  const entry = buildFromPool(
    section,
    result.items,
    result.sourcesUnreachable
  );
  setCache(section, entry);
  return entry;
}

async function refreshAll(): Promise<CacheEntry> {
  const { bySection } = await fetchAllPools();
  const perSection: HighlightItem[] = [];
  let anyReachable = false;

  for (const section of CONTENT_SECTIONS) {
    const result = bySection[section];
    const sectionEntry = buildFromPool(
      section,
      result.items,
      result.sourcesUnreachable
    );
    setCache(section, sectionEntry);

    if (!result.sourcesUnreachable) anyReachable = true;

    // All tab: top 4 newest from each section (within 24h pool)
    const top = toRawHighlights(result.items, 4);
    perSection.push(...top);
  }

  perSection.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const entry: CacheEntry = {
    section: "all",
    generatedAt: new Date().toISOString(),
    items: perSection.slice(0, getMaxItems() * 2),
    rawMode: true,
    sourcesUnreachable: !anyReachable,
    poolCount: perSection.length,
  };
  setCache("all", entry);
  return entry;
}

function sliceForWindow(
  entry: CacheEntry,
  window: TimeWindow
): HighlightItem[] {
  const maxAge =
    window === "1h"
      ? 3_600_000
      : window === "4h"
        ? 14_400_000
        : window === "12h"
          ? 43_200_000
          : 86_400_000;

  const now = Date.now();
  const filtered = entry.items.filter((item) => {
    const age = now - new Date(item.publishedAt).getTime();
    return age >= 0 && age <= maxAge;
  });

  return filtered.slice(0, getMaxItems());
}

export async function getHighlights(options: {
  section: SectionId;
  window: TimeWindow;
  forceRefresh?: boolean;
}): Promise<HighlightsResponse> {
  const { section, window, forceRefresh = false } = options;

  if (!forceRefresh) {
    const cached = getCache(section);
    if (cached.entry && cached.fresh) {
      return {
        section,
        window,
        generatedAt: cached.entry.generatedAt,
        stale: false,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        items: sliceForWindow(cached.entry, window),
      };
    }

    // Stale-while-revalidate: serve stale immediately if present
    if (cached.entry) {
      void (section === "all" ? refreshAll() : refreshSection(section));
      return {
        section,
        window,
        generatedAt: cached.entry.generatedAt,
        stale: true,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        items: sliceForWindow(cached.entry, window),
      };
    }
  }

  const entry =
    section === "all" ? await refreshAll() : await refreshSection(section);

  return {
    section,
    window,
    generatedAt: entry.generatedAt,
    stale: false,
    rawMode: entry.rawMode,
    sourcesUnreachable: entry.sourcesUnreachable,
    items: sliceForWindow(entry, window),
  };
}

// Re-export for tests / debugging
export { filterByWindow };
