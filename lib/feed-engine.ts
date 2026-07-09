import { createHash } from "crypto";
import Parser from "rss-parser";
import { FEEDS, feedsForSection } from "./feeds.config";
import type { FeedConfig, RawFeedItem, SectionId } from "./types";
import { windowToMs, type TimeWindow } from "./types";

const FEED_TIMEOUT_MS = 8_000;
const MAX_POOL_MS = windowToMs("24h");

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: {
    "User-Agent": "PulseWire/1.0 (+local news highlights)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}

function stripHtml(value: string): string {
  return decodeEntities(
    value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  );
}

function makeId(source: string, url: string, title: string): string {
  return createHash("sha1")
    .update(`${source}|${url}|${title}`)
    .digest("hex")
    .slice(0, 16);
}

function parsePublishedAt(item: {
  isoDate?: string;
  pubDate?: string;
}): string | null {
  const raw = item.isoDate || item.pubDate;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function fetchOneFeed(
  feed: FeedConfig,
  now: number
): Promise<RawFeedItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items: RawFeedItem[] = [];

    for (const entry of parsed.items ?? []) {
      const title = stripHtml(entry.title ?? "");
      const url = (entry.link || entry.guid || "").trim();
      if (!title || !url) continue;

      const publishedAt = parsePublishedAt(entry);
      if (!publishedAt) continue;

      const age = now - new Date(publishedAt).getTime();
      if (age < 0 || age > MAX_POOL_MS) continue;

      const snippet = stripHtml(
        entry.contentSnippet || entry.content || entry.summary || ""
      ).slice(0, 280);

      items.push({
        id: makeId(feed.name, url, title),
        title,
        snippet,
        source: feed.name,
        url,
        publishedAt,
        section: feed.section,
      });
    }

    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] feed skip ${feed.name} (${feed.url}): ${message}`);
    return [];
  }
}

export interface SectionFetchResult {
  items: RawFeedItem[];
  feedsAttempted: number;
  feedsSucceeded: number;
  sourcesUnreachable: boolean;
}

export async function fetchSectionPool(
  section: Exclude<SectionId, "all">
): Promise<SectionFetchResult> {
  const feeds = feedsForSection(section);
  const now = Date.now();
  const results = await Promise.all(feeds.map((feed) => fetchOneFeed(feed, now)));

  const succeeded = results.filter((r) => r.length > 0).length;
  const items = results.flat().sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return {
    items,
    feedsAttempted: feeds.length,
    feedsSucceeded: succeeded,
    sourcesUnreachable: succeeded === 0,
  };
}

export async function fetchAllPools(): Promise<{
  bySection: Record<Exclude<SectionId, "all">, SectionFetchResult>;
}> {
  const sections = [
    "india",
    "markets",
    "economy",
    "politics",
    "sports",
    "world",
    "tech",
  ] as const;

  const entries = await Promise.all(
    sections.map(async (section) => [section, await fetchSectionPool(section)] as const)
  );

  return {
    bySection: Object.fromEntries(entries) as Record<
      Exclude<SectionId, "all">,
      SectionFetchResult
    >,
  };
}

export function filterByWindow(
  items: RawFeedItem[],
  window: TimeWindow,
  now = Date.now()
): RawFeedItem[] {
  const maxAge = windowToMs(window);
  return items.filter((item) => {
    const age = now - new Date(item.publishedAt).getTime();
    return age >= 0 && age <= maxAge;
  });
}

export function trimTitle(title: string, max = 110): string {
  const clean = title.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** M1 raw highlights: one item per feed story, newest first, capped. */
export function toRawHighlights(
  items: RawFeedItem[],
  maxItems: number
): {
  text: string;
  sources: { name: string; url: string }[];
  publishedAt: string;
  hot: boolean;
}[] {
  return items.slice(0, maxItems).map((item) => ({
    text: trimTitle(item.title),
    sources: [{ name: item.source, url: item.url }],
    publishedAt: item.publishedAt,
    hot: false,
  }));
}

export function configuredFeedCount(): number {
  return FEEDS.length;
}
