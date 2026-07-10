import { getXPulseHighlights } from "./x-pulse";
import { isFeedsDownForced, isTestMode } from "./test-mode";
import type { TimeWindow } from "./types";

export interface VibeItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  column: "reddit" | "xpulse";
}

export interface VibeResponse {
  generatedAt: string;
  reddit: VibeItem[];
  xpulse: VibeItem[];
  xPulseUsage?: { month: string; used: number; cap: number };
  redditEmpty?: boolean;
  xEmpty?: boolean;
}

const SUBS = [
  "all",
  "india",
  "IndiaInvestments",
  "technology",
  "worldnews",
] as const;

const globalForVibe = globalThis as unknown as {
  __pulsewireVibe?: { at: number; payload: VibeResponse };
};

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

async function fetchSubredditRising(sub: string): Promise<VibeItem[]> {
  const url = `https://www.reddit.com/r/${sub}/rising.json?limit=5`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PulseWire/0.1 (status page; contact: pulsewire-local)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: {
      children?: Array<{
        data?: {
          title?: string;
          url?: string;
          permalink?: string;
          created_utc?: number;
          subreddit_name_prefixed?: string;
        };
      }>;
    };
  };
  const children = json.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter(Boolean)
    .map((d) => ({
      title: (d!.title || "").trim(),
      url: d!.url?.startsWith("http")
        ? d!.url
        : `https://www.reddit.com${d!.permalink || ""}`,
      source: d!.subreddit_name_prefixed || `r/${sub}`,
      publishedAt: new Date((d!.created_utc || 0) * 1000).toISOString(),
      column: "reddit" as const,
    }))
    .filter((i) => i.title && i.url);
}

async function loadReddit(): Promise<VibeItem[]> {
  if (isTestMode()) return fixtureReddit();
  if (isFeedsDownForced()) return [];

  const batches = await Promise.all(
    SUBS.map((s) => fetchSubredditRising(s).catch(() => [] as VibeItem[]))
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
  return merged.slice(0, 5);
}

export async function getVibe(window: TimeWindow = "4h"): Promise<VibeResponse> {
  const hit = globalForVibe.__pulsewireVibe;
  if (hit && Date.now() - hit.at < 5 * 60_000) {
    return hit.payload;
  }

  const [reddit, xRes] = await Promise.all([
    loadReddit(),
    getXPulseHighlights({ window, forceRefresh: false }),
  ]);

  const xpulse: VibeItem[] = (xRes.items || []).slice(0, 5).map((i) => ({
    title: i.text,
    url: i.sources[0]?.url || "https://x.com",
    source: i.sources[0]?.name || "X",
    publishedAt: i.publishedAt,
    column: "xpulse" as const,
  }));

  const payload: VibeResponse = {
    generatedAt: new Date().toISOString(),
    reddit,
    xpulse,
    xPulseUsage: xRes.xPulseUsage,
    redditEmpty: reddit.length === 0,
    xEmpty: xpulse.length === 0,
  };

  globalForVibe.__pulsewireVibe = { at: Date.now(), payload };
  return payload;
}
