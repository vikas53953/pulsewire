import { getCache, getMaxItems, setCache, type CacheEntry } from "./cache";
import { fetchAllPools, fetchSectionPool, filterByWindow } from "./feed-engine";
import { CONTENT_SECTIONS } from "./feeds.config";
import { summarizeAndDedupe } from "./llm";
import {
  applyLlmHighlights,
  clusterBySimilarity,
  clustersToRawHighlights,
} from "./merge";
import type {
  HighlightItem,
  HighlightsResponse,
  RawFeedItem,
  SectionId,
  TimeWindow,
} from "./types";
import { windowToMs } from "./types";

async function buildFromPool(
  section: Exclude<SectionId, "all">,
  pool: RawFeedItem[],
  sourcesUnreachable: boolean
): Promise<CacheEntry> {
  const maxItems = Math.max(getMaxItems() * 3, 30);
  const capped = pool.slice(0, maxItems);
  const clusters = clusterBySimilarity(capped, 0.6);

  let items: HighlightItem[];
  let rawMode = true;

  const llm = await summarizeAndDedupe(
    clusters.flatMap((c) => c.items).slice(0, 40)
  );

  if (!llm.rawMode && llm.highlights.length > 0) {
    items = applyLlmHighlights(clusters, llm.highlights, maxItems);
    rawMode = false;
  } else {
    if (llm.error) {
      console.warn(`[pulsewire] raw mode for ${section}: ${llm.error}`);
    }
    items = clustersToRawHighlights(clusters, maxItems);
    rawMode = true;
  }

  items = items.map((item) => ({ ...item, section }));

  return {
    section,
    generatedAt: new Date().toISOString(),
    items,
    rawMode,
    sourcesUnreachable,
    poolCount: pool.length,
  };
}

async function refreshSection(
  section: Exclude<SectionId, "all">
): Promise<CacheEntry> {
  const result = await fetchSectionPool(section);
  const entry = await buildFromPool(
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
  let anyLlm = false;

  for (const section of CONTENT_SECTIONS) {
    const result = bySection[section];
    const sectionEntry = await buildFromPool(
      section,
      result.items,
      result.sourcesUnreachable
    );
    setCache(section, sectionEntry);

    if (!result.sourcesUnreachable) anyReachable = true;
    if (!sectionEntry.rawMode) anyLlm = true;

    // All tab: top 4 from each section (hot first already)
    perSection.push(...sectionEntry.items.slice(0, 4));
  }

  perSection.sort((a, b) => {
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  const entry: CacheEntry = {
    section: "all",
    generatedAt: new Date().toISOString(),
    items: perSection.slice(0, getMaxItems() * 2),
    rawMode: !anyLlm,
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
  const maxAge = windowToMs(window);
  const now = Date.now();
  const filtered = entry.items.filter((item) => {
    const age = now - new Date(item.publishedAt).getTime();
    return age >= 0 && age <= maxAge;
  });

  // Keep 🔥 pinned, then recency
  filtered.sort((a, b) => {
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
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

export { filterByWindow };
