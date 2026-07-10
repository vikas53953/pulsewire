import Parser from "rss-parser";
import { getXPulseHighlights } from "./x-pulse";
import { isLlmConfigured } from "./llm";
import { isFeedsDownForced, isTestMode } from "./test-mode";
import type { TimeWindow } from "./types";

export interface VibeItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  column: "reddit" | "xpulse";
  demo?: boolean;
}

export interface VibeResponse {
  generatedAt: string;
  reddit: VibeItem[];
  xpulse: VibeItem[];
  xPulseUsage?: { month: string; used: number; cap: number };
  redditEmpty?: boolean;
  xEmpty?: boolean;
  /** Human-readable why a column is empty / demo */
  redditNote?: string;
  xNote?: string;
}

/** Atom RSS works from this environment; JSON API returns 403. */
const REDDIT_FEEDS = [
  { sub: "IndiaInvestments", url: "https://www.reddit.com/r/IndiaInvestments/.rss" },
  { sub: "india", url: "https://www.reddit.com/r/india/.rss" },
  { sub: "technology", url: "https://www.reddit.com/r/technology/.rss" },
  { sub: "worldnews", url: "https://www.reddit.com/r/worldnews/.rss" },
  { sub: "all", url: "https://www.reddit.com/r/all/.rss" },
] as const;

const globalForVibe = globalThis as unknown as {
  __pulsewireVibe?: { at: number; payload: VibeResponse };
};

const parser = new Parser({
  timeout: 8_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; PulseWire/0.1; +https://github.com/vikas53953/pulsewire)",
    Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
  },
});

function fixtureReddit(): VibeItem[] {
  const now = Date.now();
  return [
    {
      title: "Sensex futures jump as FIIs return — Reddit markets desk",
      url: "https://www.reddit.com/r/IndiaInvestments/comments/fixture1",
      source: "r/IndiaInvestments",
      publishedAt: new Date(now - 20 * 60_000).toISOString(),
      column: "reddit",
    },
    {
      title: "RBI hold thread: what desks are watching tonight",
      url: "https://www.reddit.com/r/india/comments/fixture2",
      source: "r/india",
      publishedAt: new Date(now - 45 * 60_000).toISOString(),
      column: "reddit",
    },
    {
      title: "Rising: global tech layoff tracker roundup",
      url: "https://www.reddit.com/r/technology/comments/fixture3",
      source: "r/technology",
      publishedAt: new Date(now - 70 * 60_000).toISOString(),
      column: "reddit",
    },
  ];
}

function demoXPulse(): VibeItem[] {
  const now = Date.now();
  return [
    {
      title: "Demo: markets chatter after policy hold (set LLM_API_KEY for live X)",
      url: "https://x.com",
      source: "demo",
      publishedAt: new Date(now - 15 * 60_000).toISOString(),
      column: "xpulse",
      demo: true,
    },
  ];
}

async function fetchRedditFeed(feed: {
  sub: string;
  url: string;
}): Promise<VibeItem[]> {
  const parsed = await parser.parseURL(feed.url);
  return (parsed.items || [])
    .slice(0, 5)
    .map((item) => {
      const link = item.link || item.guid || "";
      const publishedAt =
        item.isoDate ||
        (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());
      return {
        title: (item.title || "").trim(),
        url: link.startsWith("http") ? link : `https://www.reddit.com${link}`,
        source: `r/${feed.sub}`,
        publishedAt,
        column: "reddit" as const,
      };
    })
    .filter((i) => i.title && i.url);
}

async function loadReddit(): Promise<{
  items: VibeItem[];
  note?: string;
}> {
  if (isTestMode()) return { items: fixtureReddit() };
  if (isFeedsDownForced()) {
    return { items: [], note: "Feeds forced down (test)." };
  }

  const batches = await Promise.all(
    REDDIT_FEEDS.map((f) =>
      fetchRedditFeed(f).catch(() => [] as VibeItem[])
    )
  );
  const seen = new Set<string>();
  const merged: VibeItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const items = merged.slice(0, 5);
  if (items.length === 0) {
    return {
      items: [],
      note: "Reddit RSS returned nothing (blocked or empty).",
    };
  }
  return { items };
}

export async function getVibe(window: TimeWindow = "4h"): Promise<VibeResponse> {
  const hit = globalForVibe.__pulsewireVibe;
  // Don't keep a failed/empty vibe warm for 5 minutes
  const usable =
    hit &&
    Date.now() - hit.at < 5 * 60_000 &&
    (hit.payload.reddit.length > 0 || hit.payload.xpulse.length > 0);
  if (usable) return hit!.payload;

  const [redditRes, xRes] = await Promise.all([
    loadReddit(),
    getXPulseHighlights({ window, forceRefresh: false }),
  ]);

  let xpulse: VibeItem[] = (xRes.items || []).slice(0, 5).map((i) => ({
    title: i.text,
    url: i.sources[0]?.url || "https://x.com",
    source: i.sources[0]?.name || "X",
    publishedAt: i.publishedAt,
    column: "xpulse" as const,
  }));

  let xNote: string | undefined;
  if (xpulse.length === 0) {
    if (!isTestMode() && !isLlmConfigured()) {
      xpulse = demoXPulse();
      xNote = "Live X needs LLM_API_KEY — showing labeled demo.";
    } else {
      xNote =
        (xRes as { error?: string }).error ||
        "X Pulse returned no posts this window.";
    }
  }

  const payload: VibeResponse = {
    generatedAt: new Date().toISOString(),
    reddit: redditRes.items,
    xpulse,
    xPulseUsage: xRes.xPulseUsage,
    redditEmpty: redditRes.items.length === 0,
    xEmpty: xpulse.length === 0,
    redditNote: redditRes.note,
    xNote,
  };

  globalForVibe.__pulsewireVibe = { at: Date.now(), payload };
  return payload;
}

/** Test / ops: drop in-memory vibe cache */
export function clearVibeCacheForTests(): void {
  globalForVibe.__pulsewireVibe = undefined;
}
