import type { HighlightItem, SectionId } from "./types";

export interface CacheEntry {
  section: Exclude<SectionId, "all"> | "all";
  generatedAt: string;
  items: HighlightItem[];
  rawMode: boolean;
  sourcesUnreachable: boolean;
  /** Underlying 24h pool size before window slice (debug). */
  poolCount: number;
}

interface Stored {
  entry: CacheEntry;
  storedAt: number;
  refreshing?: Promise<CacheEntry>;
}

const globalForCache = globalThis as unknown as {
  __pulsewireCache?: Map<string, Stored>;
};

const cache: Map<string, Stored> =
  globalForCache.__pulsewireCache ?? new Map<string, Stored>();

if (!globalForCache.__pulsewireCache) {
  globalForCache.__pulsewireCache = cache;
}

function ttlMs(rawMode: boolean): number {
  // PW_TEST may set RAW_CACHE_TTL_MS for sub-minute expiry assertions
  if (rawMode && process.env.RAW_CACHE_TTL_MS) {
    return Math.max(50, Number(process.env.RAW_CACHE_TTL_MS));
  }
  if (rawMode) {
    const minutes = Number(process.env.RAW_CACHE_TTL_MINUTES ?? "2");
    return Math.max(0.05, minutes) * 60_000;
  }
  const minutes = Number(process.env.CACHE_TTL_MINUTES ?? "10");
  return Math.max(1, minutes) * 60_000;
}

export function getMaxItems(): number {
  return Math.max(1, Number(process.env.MAX_ITEMS_PER_SECTION ?? "10"));
}

export function cacheKey(section: string): string {
  return `section:${section}`;
}

export function getCache(section: string): {
  entry: CacheEntry | null;
  fresh: boolean;
  ageMs: number;
} {
  const stored = cache.get(cacheKey(section));
  if (!stored) return { entry: null, fresh: false, ageMs: 0 };

  // Placeholder from in-flight warm (epoch generatedAt + empty) is not usable
  if (
    stored.entry.items.length === 0 &&
    new Date(stored.entry.generatedAt).getTime() === 0
  ) {
    return { entry: null, fresh: false, ageMs: 0 };
  }

  const ageMs = Date.now() - stored.storedAt;
  const fresh = ageMs < ttlMs(stored.entry.rawMode);
  return { entry: stored.entry, fresh, ageMs };
}

export function setCache(section: string, entry: CacheEntry): void {
  const key = cacheKey(section);
  const prev = cache.get(key);
  cache.set(key, {
    entry,
    storedAt: Date.now(),
    refreshing: prev?.refreshing,
  });
}

export function clearCache(section?: string): void {
  if (section) {
    cache.delete(cacheKey(section));
    return;
  }
  cache.clear();
}

export function getRefreshing(
  section: string
): Promise<CacheEntry> | undefined {
  return cache.get(cacheKey(section))?.refreshing;
}

export function setRefreshing(
  section: string,
  promise: Promise<CacheEntry> | undefined
): void {
  const key = cacheKey(section);
  const stored = cache.get(key);
  if (!stored) {
    if (!promise) return;
    cache.set(key, {
      entry: {
        section: section as CacheEntry["section"],
        generatedAt: new Date(0).toISOString(),
        items: [],
        rawMode: true,
        sourcesUnreachable: false,
        poolCount: 0,
      },
      storedAt: 0,
      refreshing: promise,
    });
    return;
  }
  if (promise) {
    stored.refreshing = promise;
  } else {
    delete stored.refreshing;
  }
}
