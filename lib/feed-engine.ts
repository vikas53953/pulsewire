import { createHash } from "crypto";
import Parser from "rss-parser";
import { FEEDS, feedsForSection } from "./feeds.config";
import { resolveArticleUrls } from "./resolve-url";
import { sanitizeHttpUrl } from "./safe-url";
import { titleForFeed } from "./similarity";
import {
  fixtureItemsForSection,
  isFeedsDownForced,
  isTestMode,
} from "./test-mode";
import type { ContentSectionId, FeedConfig, RawFeedItem } from "./types";
import { windowToMs, type TimeWindow } from "./types";
import { flashHeadline } from "./flash";

export { flashHeadline, trimTitle } from "./flash";

const FEED_TIMEOUT_MS = 8_000;
const MAX_POOL_MS = windowToMs("24h");
/**
 * Cap items kept per individual feed before merge.
 * Must be deep enough that wider windows (12h/24h) still see older stories
 * after the newest burst — not only the last ~1h of a busy feed.
 */
const PER_FEED_CAP = 30;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: {
    "User-Agent": "PulseWire/1.0 (+local news highlights)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i;

/** Prefer https; upgrade http → https (the tile falls back on load error anyway). */
function normalizeImageUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const upgraded = raw.startsWith("http://")
    ? raw.replace(/^http:\/\//, "https://")
    : raw;
  const safe = sanitizeHttpUrl(upgraded.trim());
  if (!safe || !safe.startsWith("https://")) return null;
  return safe;
}

function attrUrl(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const attrs = (node as { $?: Record<string, string> }).$;
  return attrs?.url;
}

/**
 * Best article image from RSS — media:content, media:thumbnail, enclosure, or
 * the first <img> in content:encoded. No page fetching, no scraping. Returns a
 * sanitized https URL or null (→ designed fallback tile downstream).
 */
export function extractImage(entry: Record<string, unknown>): string | null {
  // 1) media:content (may be an array) — prefer image medium/type.
  const mc = entry.mediaContent;
  const mcList = Array.isArray(mc) ? mc : mc ? [mc] : [];
  for (const node of mcList) {
    const attrs = (node as { $?: Record<string, string> }).$;
    const url = attrs?.url;
    if (!url) continue;
    const isImage =
      attrs?.medium === "image" ||
      (attrs?.type ?? "").startsWith("image/") ||
      IMG_EXT_RE.test(url);
    if (isImage) {
      const norm = normalizeImageUrl(url);
      if (norm) return norm;
    }
  }

  // 2) media:thumbnail
  const thumb = normalizeImageUrl(attrUrl(entry.mediaThumbnail));
  if (thumb) return thumb;

  // 3) enclosure (rss-parser native)
  const enc = entry.enclosure as
    | { url?: string; type?: string }
    | undefined;
  if (enc?.url) {
    const isImage =
      (enc.type ?? "").startsWith("image/") || IMG_EXT_RE.test(enc.url);
    if (isImage) {
      const norm = normalizeImageUrl(enc.url);
      if (norm) return norm;
    }
  }

  // 4) first <img> in content:encoded / content
  const body =
    (entry.contentEncoded as string | undefined) ||
    (entry.content as string | undefined) ||
    "";
  const imgMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const norm = normalizeImageUrl(imgMatch[1]);
    if (norm) return norm;
  }

  return null;
}

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

function sourceLabelFromTitle(title: string, fallback: string): string {
  const m = title.match(/\s[-–|]\s([^–|-]{2,60})$/);
  if (m?.[1] && !/google news/i.test(m[1])) return m[1].trim();
  return fallback;
}

async function fetchOneFeed(
  feed: FeedConfig,
  now: number
): Promise<RawFeedItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items: RawFeedItem[] = [];

    for (const entry of parsed.items ?? []) {
      const rawTitle = stripHtml(entry.title ?? "");
      // Publisher suffix is a Google News artifact — flag-gated, never name-guessed.
      const title = titleForFeed(rawTitle, {
        hasPublisherSuffix: feed.hasPublisherSuffix,
      });
      const url = sanitizeHttpUrl(entry.link || entry.guid || "");
      if (!title || !url) continue;

      const publishedAt = parsePublishedAt(entry);
      if (!publishedAt) continue;

      const age = now - new Date(publishedAt).getTime();
      if (age < 0 || age > MAX_POOL_MS) continue;

      const snippet = stripHtml(
        entry.contentSnippet || entry.content || entry.summary || ""
      ).slice(0, 280);

      const source = feed.hasPublisherSuffix
        ? sourceLabelFromTitle(rawTitle, feed.name)
        : feed.name;

      items.push({
        id: makeId(source, url, title),
        title,
        snippet,
        source,
        url,
        publishedAt,
        section: feed.section,
        image: extractImage(entry as unknown as Record<string, unknown>) ?? undefined,
      });

      if (items.length >= PER_FEED_CAP) break;
    }

    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] feed skip ${feed.name} (${feed.url}): ${message}`);
    return [];
  }
}

async function resolveItemUrls(items: RawFeedItem[]): Promise<RawFeedItem[]> {
  const map = await resolveArticleUrls(items.map((i) => i.url));
  return items
    .map((item) => {
      const resolved = sanitizeHttpUrl(map.get(item.url) ?? item.url);
      return resolved ? { ...item, url: resolved } : null;
    })
    .filter((item): item is RawFeedItem => item != null);
}

export interface SectionFetchResult {
  items: RawFeedItem[];
  feedsAttempted: number;
  feedsSucceeded: number;
  sourcesUnreachable: boolean;
}

export async function fetchSectionPool(
  section: ContentSectionId
): Promise<SectionFetchResult> {
  if (isTestMode()) {
    if (isFeedsDownForced()) {
      return {
        items: [],
        feedsAttempted: 2,
        feedsSucceeded: 0,
        sourcesUnreachable: true,
      };
    }
    const items = fixtureItemsForSection(section).sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    return {
      items,
      feedsAttempted: 2,
      feedsSucceeded: 2,
      sourcesUnreachable: false,
    };
  }

  const feeds = feedsForSection(section);
  const now = Date.now();
  const results = await Promise.all(feeds.map((feed) => fetchOneFeed(feed, now)));

  const succeeded = results.filter((r) => r.length > 0).length;
  const flat = results.flat().sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const items = await resolveItemUrls(flat);

  return {
    items,
    feedsAttempted: feeds.length,
    feedsSucceeded: succeeded,
    sourcesUnreachable: succeeded === 0,
  };
}

export async function fetchAllPools(): Promise<{
  bySection: Record<ContentSectionId, SectionFetchResult>;
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
      ContentSectionId,
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

/** Raw-mode fallback highlights from a pre-merged cluster list. */
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
    text: flashHeadline(item.title),
    sources: [
      {
        name: item.source,
        url: item.url,
        firstSeen: item.publishedAt,
      },
    ],
    publishedAt: item.publishedAt,
    hot: false,
    firstSeen: item.publishedAt,
  }));
}

export function configuredFeedCount(): number {
  return FEEDS.length;
}
