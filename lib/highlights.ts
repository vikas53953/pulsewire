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
import { filterSince, rankAndCapForWindow } from "./rank";
import { enrichItemHeat, scoreSection } from "./score";
import type {
  ContentSectionId,
  HighlightItem,
  HighlightsResponse,
  Lens,
  RawFeedItem,
  SectionId,
  SectionScore,
  TimeWindow,
} from "./types";
import { SCORE_CHIP_ORDER } from "./types";
import { buildVerdictTemplate } from "./verdict";
import { getXPulseHighlights } from "./x-pulse";

/** Keep a large 24h pool in cache; window + cap applied at request time. */
const POOL_CAP = 80;

async function buildFromPool(
  section: ContentSectionId,
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

  items = items.map((item) => enrichItemHeat({ ...item, section }));

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
  section: ContentSectionId
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
  bySection: Record<ContentSectionId, CacheEntry>
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

  perSection.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));

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
    const entries = {} as Record<ContentSectionId, CacheEntry>;

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

async function ensureSectionCaches(
  forceRefresh: boolean
): Promise<Record<ContentSectionId, CacheEntry>> {
  const out = {} as Record<ContentSectionId, CacheEntry>;

  for (const section of CONTENT_SECTIONS) {
    if (!forceRefresh) {
      const cached = getCache(section);
      if (cached.entry && cached.fresh && cached.entry.items.length > 0) {
        out[section] = cached.entry;
        continue;
      }
      if (cached.entry && cached.entry.items.length > 0) {
        void refreshSection(section);
        out[section] = cached.entry;
        continue;
      }
    }
    out[section] = await refreshSection(section);
  }

  return out;
}

function computeAllScores(
  bySection: Record<ContentSectionId, CacheEntry>,
  window: TimeWindow,
  lens: Lens,
  sinceIso: string | undefined,
  now: number
): SectionScore[] {
  return SCORE_CHIP_ORDER.map((section) => {
    const entry = bySection[section];
    let items = entry?.items ?? [];
    if (lens === "since" && sinceIso) {
      items = filterSince(items, sinceIso);
    } else {
      const maxAge =
        window === "1h"
          ? 3_600_000
          : window === "4h"
            ? 14_400_000
            : window === "12h"
              ? 43_200_000
              : 86_400_000;
      items = items.filter((i) => {
        const age = now - new Date(i.publishedAt).getTime();
        return age >= 0 && age <= maxAge;
      });
    }
    return scoreSection(section, items, now);
  });
}

function relativeSince(sinceIso: string, now = Date.now()): string {
  const ms = now - new Date(sinceIso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export async function getHighlights(options: {
  section: SectionId;
  window: TimeWindow;
  forceRefresh?: boolean;
  lens?: Lens;
  since?: string;
}): Promise<HighlightsResponse> {
  const {
    section,
    window,
    forceRefresh = false,
    lens = "window",
    since,
  } = options;
  const now = Date.now();

  if (section === "vibe" || section === "radar") {
    // Dedicated routes: /api/vibe, /api/radar
    return {
      section,
      window,
      lens: "window",
      generatedAt: new Date().toISOString(),
      stale: false,
      rawMode: true,
      verdict: {
        text:
          section === "vibe"
            ? "Vibe check — use /api/vibe."
            : "Radar — use /api/radar.",
        level: "green",
        llmPolished: false,
      },
      scores: [],
      items: [],
    };
  }

  if (section === "xpulse") {
    const xp = await getXPulseHighlights({ window, forceRefresh });
    const bySection = await ensureSectionCaches(false);
    const scores = computeAllScores(bySection, window, "window", undefined, now);
    const verdict = buildVerdictTemplate({ scores, lens: "window" });
    return {
      ...xp,
      lens: "window",
      verdict,
      scores,
      items: xp.items.map((i) => enrichItemHeat(i, now)),
    };
  }

  if (forceRefresh) {
    console.info(
      `[pulsewire] cache-miss force refresh section=${section} window=${window} lens=${lens}`
    );
  }

  const bySection = await ensureSectionCaches(forceRefresh);

  // Keep "all" cache in sync for warmer / all-tab
  if (forceRefresh || !getCache("all").entry) {
    const allEntry = buildAllFromSections(bySection);
    setCache("all", allEntry);
  } else if (!getCache("all").fresh) {
    void refreshAll();
  }

  const scores = computeAllScores(bySection, window, lens, since, now);

  let pool: HighlightItem[] = [];
  let rawMode = true;
  let sourcesUnreachable = false;
  let generatedAt = new Date().toISOString();
  let cacheMiss = forceRefresh;

  if (section === "all") {
    const allCached = getCache("all");
    const entry = allCached.entry ?? buildAllFromSections(bySection);
    if (!allCached.entry) setCache("all", entry);
    pool = entry.items;
    rawMode = entry.rawMode;
    sourcesUnreachable = entry.sourcesUnreachable;
    generatedAt = entry.generatedAt;
    cacheMiss = forceRefresh || !allCached.fresh;
  } else {
    const entry = bySection[section as ContentSectionId];
    pool = entry.items;
    rawMode = entry.rawMode;
    sourcesUnreachable = entry.sourcesUnreachable;
    generatedAt = entry.generatedAt;
    const cached = getCache(section);
    cacheMiss = forceRefresh || !cached.fresh;
  }

  let sliced: HighlightItem[];
  let sinceEmpty = false;

  if (lens === "since" && since) {
    const sinceItems = filterSince(pool, since).map((i) =>
      enrichItemHeat(i, now)
    );
    sinceEmpty = sinceItems.length === 0;
    // Rank within a synthetic 24h window after since-filter
    sliced = rankAndCapForWindow(sinceItems, "24h", getMaxItems(), now);
  } else {
    sliced = rankAndCapForWindow(pool, window, getMaxItems(), now);
  }

  const verdictBase = buildVerdictTemplate({
    scores,
    lens,
    sinceRelative: since ? relativeSince(since, now) : undefined,
    sinceEmpty: lens === "since" && sinceEmpty,
  });

  // Radar tripwires outrank RSS heat when tripped (SPEC v3.3).
  let verdict = verdictBase;
  try {
    const { getRadarStatus } = await import("./radar");
    const radar = getRadarStatus();
    if (radar.verdictHint?.level === "red") {
      verdict = radar.verdictHint;
    }
  } catch {
    // radar optional at boot
  }

  return {
    section,
    window,
    lens,
    generatedAt,
    stale: false,
    rawMode,
    sourcesUnreachable,
    cacheMiss,
    verdict,
    scores,
    items: sliced,
  };
}

export { filterByWindow };
