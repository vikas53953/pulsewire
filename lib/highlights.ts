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
import {
  fuseSocialIntoItems,
  rankWithSignalStates,
  type SocialSignal,
} from "./fusion";
import { summarizeAndDedupe } from "./llm";
import {
  applyLlmHighlights,
  clusterBySimilarity,
  clustersToRawHighlights,
} from "./merge";
import { filterSince, rankAndCapForWindow, ALL_CAP, DESK_CAP } from "./rank";
import { getRedditSignals } from "./reddit-plane";
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
import { buildSocialTrendsPack } from "./trend";
import { getXPulseHighlights } from "./x-pulse";
import { isTestMode } from "./test-mode";

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

  // M7: attach Reddit (+ cached X if present) as plane evidence — never force X fetch.
  try {
    const reddit = await getRedditSignals();
    const xSignals = await loadCachedXSignals(section);
    const fused = fuseSocialIntoItems(items, [...reddit, ...xSignals]);
    items = fused.map((item) => enrichItemHeat({ ...item, section }));
  } catch (err) {
    console.warn(
      `[pulsewire] fusion skip ${section}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    section,
    generatedAt: new Date().toISOString(),
    items,
    rawMode,
    sourcesUnreachable,
    poolCount: pool.length,
  };
}

/** X plane for fusion — cache only (M8 governor earns live calls). */
async function loadCachedXSignals(
  _section: ContentSectionId,
): Promise<SocialSignal[]> {
  if (isTestMode()) {
    const { isEarlyXForced, isFusionForced } = await import("./test-mode");
    if (isEarlyXForced() || isFusionForced()) {
      const now = Date.now();
      return [
        {
          plane: "x",
          title: isEarlyXForced()
            ? "X-only rumor: mystery markets spike with no wire yet"
            : "RBI shock rate hold sparks bank rally as Sensex futures jump after inflation cools",
          url: "https://x.com/fixture/status/early1",
          source: "@marketswire",
          publishedAt: new Date(now - 15 * 60_000).toISOString(),
          section: "markets",
          sections: ["markets"],
          velocity: 4,
        },
      ];
    }
    return [];
  }
  try {
    const cached = getCache("xpulse");
    if (!cached.entry?.items?.length) return [];
    // Do NOT stamp the active desk onto every X item — that made every
    // section's "On X" column look identical / wrong. Untagged X attaches
    // via title match to that desk's wires (fusion + trend).
    return cached.entry.items.slice(0, 12).map((i) => {
      const raw = i.section;
      const tagged =
        raw &&
        raw !== "xpulse" &&
        raw !== "vibe" &&
        raw !== "radar"
          ? (raw as ContentSectionId)
          : undefined;
      return {
        plane: "x" as const,
        title: i.text.replace(/^X Pulse:\s*/i, ""),
        url: i.sources[0]?.url || "https://x.com",
        source: i.sources[0]?.name || "@x",
        publishedAt: i.publishedAt,
        section: tagged,
        sections: tagged ? [tagged] : undefined,
        velocity: i.velocity,
      };
    });
  } catch {
    return [];
  }
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

  if (section === "trend") {
    const bySection = await ensureSectionCaches(forceRefresh);
    const scores = computeAllScores(bySection, window, "window", undefined, now);
    const verdict = buildVerdictTemplate({ scores, lens: "window" });
    let socialTrends;
    try {
      let reddit = await getRedditSignals();
      if (reddit.length === 0) {
        reddit = await getRedditSignals({ forceRefresh: true });
      }
      let xSignals = await loadXSignalsFromPulseCache();
      if (xSignals.length === 0) {
        xSignals = await loadCachedXSignals("markets");
      }
      socialTrends = buildSocialTrendsPack({ reddit, x: xSignals });
    } catch (err) {
      console.warn(
        `[pulsewire] trend panel skip: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return {
      section: "trend",
      window,
      lens: "window",
      generatedAt: new Date().toISOString(),
      stale: false,
      rawMode: true,
      verdict: {
        text: "Trend — what’s loud on Reddit and X.",
        level: "green",
        llmPolished: false,
      },
      scores,
      items: [],
      socialTrends,
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
  void scores; // recomputed with fusion-aware sliced pool below

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
  const boardCap = section === "all" ? ALL_CAP : DESK_CAP;

  if (lens === "since" && since) {
    const sinceItems = filterSince(pool, since).map((i) =>
      enrichItemHeat(i, now)
    );
    sinceEmpty = sinceItems.length === 0;
    sliced = rankWithSignalStates(
      rankAndCapForWindow(sinceItems, "24h", boardCap, now),
    );
  } else {
    sliced = rankWithSignalStates(
      rankAndCapForWindow(pool, window, boardCap, now),
    );
  }

  // Inject tripwire hits as confirmed RSS-plane items (SPEC v4 §1).
  try {
    const { getRadarStatus } = await import("./radar");
    const radar = getRadarStatus();
    if (!radar.clear && radar.trips.length > 0) {
      const tripsAsItems: HighlightItem[] = radar.trips.map((t) => ({
        text: t.title,
        sources: [{ name: t.name, url: t.url, firstSeen: t.trippedAt }],
        publishedAt: t.trippedAt,
        hot: true,
        section: section === "all" ? "markets" : (section as ContentSectionId),
        tripwire: true,
        signalState: "confirmed" as const,
        evidence: [
          {
            plane: "tripwire" as const,
            source: t.name,
            url: t.url,
            firstSeen: t.trippedAt,
          },
        ],
        clusterId: `tripwire-${t.id}-${t.trippedAt}`,
      }));
      sliced = rankWithSignalStates([
        ...tripsAsItems.map((i) => enrichItemHeat(i, now)),
        ...sliced,
      ]);
    }
  } catch {
    // radar optional
  }

  const scoresWithFusion = computeAllScores(
    bySection,
    window,
    lens,
    since,
    now,
  );
  const scoredFromSliced =
    section !== "all"
      ? scoreSection(section as ContentSectionId, sliced, now, {
          persistHistory: false,
        })
      : null;
  let finalScores = scoredFromSliced
    ? scoresWithFusion.map((s) =>
        s.section === scoredFromSliced.section ? scoredFromSliced : s,
      )
    : scoresWithFusion;

  // M8: earn X from heat escalation / Reddit spikes (never on a timer).
  try {
    const {
      maybeEarnHeatEscalation,
      maybeEarnRedditSpike,
      getXGovernorStatus,
    } = await import("./x-governor");
    const { fetchXAfterGrant } = await import("./x-pulse");
    const { getRedditSignals } = await import("./reddit-plane");

    for (const s of finalScores) {
      const decision = maybeEarnHeatEscalation({
        section: s.section,
        score: s.score,
        socialLed: s.socialLed,
      });
      if (decision?.allowed) {
        await fetchXAfterGrant(decision, window);
        break; // one earned call per request max
      }
    }

    const reddit = await getRedditSignals();
    for (const sig of reddit) {
      if (!sig.section || (sig.velocity ?? 0) < 5) continue;
      const decision = maybeEarnRedditSpike({
        section: sig.section,
        title: sig.title,
        velocity: sig.velocity ?? 0,
      });
      if (decision?.allowed) {
        await fetchXAfterGrant(decision, window);
        break;
      }
    }

    // If EARLY plane paused, strip unlabeled early items from response honesty
    const gov = getXGovernorStatus();
    if (gov.paused) {
      sliced = sliced.filter((i) => i.signalState !== "early");
    }
  } catch (err) {
    console.warn(
      `[pulsewire] x-governor skip: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const verdictBase = buildVerdictTemplate({
    scores: finalScores,
    lens,
    sinceRelative: since ? relativeSince(since, now) : undefined,
    sinceEmpty: lens === "since" && sinceEmpty,
    topItems: sliced,
  });

  // Radar tripwires outrank RSS heat when tripped (SPEC v3.3 / v4 tripwire).
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

  let xGovernor;
  let xPulseUsage;
  try {
    const { getXGovernorStatus } = await import("./x-governor");
    const { getXPulseUsage } = await import("./x-pulse");
    const gov = getXGovernorStatus();
    xGovernor = {
      dailyUsed: gov.dailyUsed,
      dailyCap: gov.dailyCap,
      monthlyUsed: gov.monthlyUsed,
      monthlyCap: gov.monthlyCap,
      paused: gov.paused,
      pauseNote: gov.pauseNote,
    };
    xPulseUsage = getXPulseUsage();
  } catch {
    // optional
  }

  // Social board only on TREND chip (early return) — news desks stay clean.
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
    scores: finalScores,
    items: sliced,
    xGovernor,
    xPulseUsage,
  };
}

/** Untagged X pulse items for desk-scoped trend matching. */
async function loadXSignalsFromPulseCache(): Promise<SocialSignal[]> {
  if (isTestMode()) return [];
  try {
    const xp = await getXPulseHighlights({
      window: "4h",
      forceRefresh: false,
    });
    return (xp.items || []).slice(0, 12).map((i) => {
      const raw = i.section;
      const tagged =
        raw &&
        raw !== "xpulse" &&
        raw !== "vibe" &&
        raw !== "radar"
          ? (raw as ContentSectionId)
          : undefined;
      return {
        plane: "x" as const,
        title: i.text.replace(/^X Pulse:\s*/i, ""),
        url: i.sources[0]?.url || "https://x.com",
        source: i.sources[0]?.name || "@x",
        publishedAt: i.publishedAt,
        section: tagged,
        sections: tagged ? [tagged] : undefined,
        velocity: i.velocity,
      };
    });
  } catch {
    return [];
  }
}

export { filterByWindow };
