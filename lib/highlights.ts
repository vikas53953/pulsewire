import {
  getCache,
  getMaxItems,
  getRefreshing,
  setCache,
  setRefreshing,
  type CacheEntry,
} from "./cache";
import { fetchAllPools, fetchSectionPool, filterByWindow } from "./feed-engine";
import { CONTENT_SECTIONS } from "./feeds.config";
import { summarizeAndDedupe } from "./llm";
import {
  applyLlmHighlights,
  clusterBySimilarity,
  clustersToRawHighlights,
} from "./merge";
import { rankAndCapForWindow } from "./rank";
import type {
  HighlightItem,
  HighlightsResponse,
  RawFeedItem,
  SectionId,
  TimeWindow,
} from "./types";

/** Keep a large 24h pool in cache; window + cap applied at request time. */
const POOL_CAP = 80;

async function buildFromPool(
  section: Exclude<SectionId, "all">,
  pool: RawFeedItem[],
  sourcesUnreachable: boolean
): Promise<CacheEntry> {
  const capped = pool.slice(0, POOL_CAP);
  const clusters = clusterBySimilarity(capped, 0.6);

  let items: HighlightItem[];
  let rawMode = true;

  const llm = await summarizeAndDedupe(
    clusters.flatMap((c) => c.items).slice(0, 40)
  );

  if (!llm.rawMode && llm.highlights.length > 0) {
    items = applyLlmHighlights(clusters, llm.highlights, POOL_CAP);
    rawMode = false;
  } else {
    if (llm.error) {
      console.warn(`[pulsewire] raw mode for ${section}: ${llm.error}`);
    }
    items = clustersToRawHighlights(clusters, POOL_CAP);
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

export async function refreshSection(
  section: Exclude<SectionId, "all">
): Promise<CacheEntry> {
  const existing = getRefreshing(section);
  if (existing) return existing;

  const promise = (async () => {
    const result = await fetchSectionPool(section);
    const entry = await buildFromPool(
      section,
      result.items,
      result.sourcesUnreachable
    );
    setCache(section, entry);
    return entry;
  })().finally(() => setRefreshing(section, undefined));

  setRefreshing(section, promise);
  return promise;
}

function buildAllFromSections(
  bySection: Record<Exclude<SectionId, "all">, CacheEntry>
): CacheEntry {
  const perSection: HighlightItem[] = [];
  let anyReachable = false;
  let anyLlm = false;

  for (const section of CONTENT_SECTIONS) {
    const sectionEntry = bySection[section];
    if (!sectionEntry) continue;
    if (!sectionEntry.sourcesUnreachable) anyReachable = true;
    if (!sectionEntry.rawMode) anyLlm = true;
    perSection.push(...sectionEntry.items.slice(0, 12));
  }

  perSection.sort((a, b) => {
    const aSources = a.hot ? a.sources.length : 0;
    const bSources = b.hot ? b.sources.length : 0;
    if (aSources !== bSources) return bSources - aSources;
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  return {
    section: "all",
    generatedAt: new Date().toISOString(),
    items: perSection.slice(0, POOL_CAP),
    rawMode: !anyLlm,
    sourcesUnreachable: !anyReachable,
    poolCount: perSection.length,
  };
}

export async function refreshAll(): Promise<CacheEntry> {
  const existing = getRefreshing("all");
  if (existing) return existing;

  const promise = (async () => {
    const { bySection } = await fetchAllPools();
    const entries = {} as Record<Exclude<SectionId, "all">, CacheEntry>;

    // Build sections sequentially for LLM rate limits; feeds already fetched in parallel
    for (const section of CONTENT_SECTIONS) {
      const result = bySection[section];
      const sectionEntry = await buildFromPool(
        section,
        result.items,
        result.sourcesUnreachable
      );
      setCache(section, sectionEntry);
      entries[section] = sectionEntry;
    }

    const entry = buildAllFromSections(entries);
    setCache("all", entry);
    return entry;
  })().finally(() => setRefreshing("all", undefined));

  setRefreshing("all", promise);
  return promise;
}

function sliceForWindow(
  entry: CacheEntry,
  window: TimeWindow
): HighlightItem[] {
  return rankAndCapForWindow(entry.items, window, getMaxItems());
}

export async function getHighlights(options: {
  section: SectionId;
  window: TimeWindow;
  forceRefresh?: boolean;
}): Promise<HighlightsResponse> {
  const { section, window, forceRefresh = false } = options;

  if (forceRefresh) {
    console.info(
      `[pulsewire] cache-miss force refresh section=${section} window=${window}`
    );
  }

  if (!forceRefresh) {
    const cached = getCache(section);
    if (cached.entry && cached.fresh && cached.entry.items.length > 0) {
      return {
        section,
        window,
        generatedAt: cached.entry.generatedAt,
        stale: false,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        cacheMiss: false,
        items: sliceForWindow(cached.entry, window),
      };
    }

    if (cached.entry && cached.entry.items.length > 0) {
      console.info(
        `[pulsewire] cache-stale SWR section=${section} ageMs=${cached.ageMs}`
      );
      void (section === "all" ? refreshAll() : refreshSection(section));
      return {
        section,
        window,
        generatedAt: cached.entry.generatedAt,
        stale: true,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        cacheMiss: false,
        items: sliceForWindow(cached.entry, window),
      };
    }

    console.info(`[pulsewire] cache-miss cold section=${section}`);
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
    cacheMiss: true,
    items: sliceForWindow(entry, window),
  };
}

export { filterByWindow };
