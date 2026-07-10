import Parser from "rss-parser";
import { getXPulseHighlights } from "./x-pulse";
import { isLlmConfigured } from "./llm";
import { isFeedsDownForced, isTestMode } from "./test-mode";
import type { TimeWindow } from "./types";

export type VibeColumnStatus =
  | "ok"
  | "quiet"
  | "failed"
  | "pending"
  | "needs_key";

export interface VibeItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  column: "reddit" | "xpulse";
}

export interface VibeColumn {
  status: VibeColumnStatus;
  items: VibeItem[];
  /** Plain-English — never use "quiet" for failed/pending/needs_key */
  note: string;
}

export interface VibeResponse {
  generatedAt: string;
  reddit: VibeColumn;
  xpulse: VibeColumn;
  xPulseUsage?: { month: string; used: number; cap: number };
}

/** Atom RSS — JSON API often 403 without OAuth from datacenter IPs. */
const REDDIT_FEEDS = [
  { sub: "IndiaInvestments", url: "https://www.reddit.com/r/IndiaInvestments/.rss" },
  { sub: "india", url: "https://www.reddit.com/r/india/.rss" },
  { sub: "technology", url: "https://www.reddit.com/r/technology/.rss" },
  { sub: "worldnews", url: "https://www.reddit.com/r/worldnews/.rss" },
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

function fixtureX(): VibeItem[] {
  const now = Date.now();
  return [
    {
      title: "X Pulse: markets buzz as Sensex futures spike after RBI hold",
      url: "https://x.com/marketswire/status/1",
      source: "@marketswire",
      publishedAt: new Date(now - 25 * 60_000).toISOString(),
      column: "xpulse",
    },
    {
      title: "X Pulse: cricket final trending — India fans flood the timeline",
      url: "https://x.com/cricpulse/status/3",
      source: "@cricpulse",
      publishedAt: new Date(now - 80 * 60_000).toISOString(),
      column: "xpulse",
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

async function loadRedditColumn(): Promise<VibeColumn> {
  if (isFeedsDownForced()) {
    return {
      status: "failed",
      items: [],
      note: "Fetch failed — feeds forced down.",
    };
  }
  if (isTestMode()) {
    return {
      status: "ok",
      items: fixtureReddit(),
      note: "Fixture Reddit.",
    };
  }

  const results = await Promise.allSettled(
    REDDIT_FEEDS.map((f) => fetchRedditFeed(f))
  );
  const batches = results
    .filter((r): r is PromiseFulfilledResult<VibeItem[]> => r.status === "fulfilled")
    .map((r) => r.value);
  const rejected = results.filter((r) => r.status === "rejected").length;

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

  if (items.length > 0) {
    return { status: "ok", items, note: "Live Reddit RSS." };
  }
  if (rejected === REDDIT_FEEDS.length || batches.every((b) => b.length === 0)) {
    return {
      status: "failed",
      items: [],
      note: "Fetch failed — Reddit RSS blocked or empty (JSON API often 403; use RSS/OAuth).",
    };
  }
  return {
    status: "quiet",
    items: [],
    note: "Quiet — fetched, nothing trending in watched subs.",
  };
}

async function loadXColumn(window: TimeWindow): Promise<{
  column: VibeColumn;
  usage?: { month: string; used: number; cap: number };
}> {
  if (isTestMode()) {
    return {
      column: {
        status: "ok",
        items: fixtureX(),
        note: "Fixture X Pulse.",
      },
    };
  }

  if (!isLlmConfigured()) {
    return {
      column: {
        status: "needs_key",
        items: [],
        note: "Not fetched yet — set LLM_API_KEY for live x_search (0 calls until then).",
      },
    };
  }

  try {
    const xRes = await getXPulseHighlights({ window, forceRefresh: true });
    const items: VibeItem[] = (xRes.items || []).slice(0, 5).map((i) => ({
      title: i.text,
      url: i.sources[0]?.url || "https://x.com",
      source: i.sources[0]?.name || "X",
      publishedAt: i.publishedAt,
      column: "xpulse" as const,
    }));
    if (items.length === 0) {
      return {
        column: {
          status: xRes.rawMode ? "failed" : "quiet",
          items: [],
          note: xRes.rawMode
            ? "Fetch failed — X Pulse raw/error (check key + x_search)."
            : "Quiet — fetched, nothing loud on X this window.",
        },
        usage: xRes.xPulseUsage,
      };
    }
    return {
      column: {
        status: "ok",
        items,
        note: "Live X Pulse via x_search.",
      },
      usage: xRes.xPulseUsage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      column: {
        status: "failed",
        items: [],
        note: `Fetch failed — ${message.slice(0, 120)}`,
      },
    };
  }
}

export async function getVibe(
  window: TimeWindow = "4h",
  opts?: { forceRefresh?: boolean }
): Promise<VibeResponse> {
  const hit = globalForVibe.__pulsewireVibe;
  if (
    !opts?.forceRefresh &&
    hit &&
    Date.now() - hit.at < 5 * 60_000 &&
    hit.payload.reddit.status === "ok" &&
    (hit.payload.xpulse.status === "ok" ||
      hit.payload.xpulse.status === "needs_key")
  ) {
    return hit.payload;
  }

  const [reddit, xPack] = await Promise.all([
    loadRedditColumn(),
    loadXColumn(window),
  ]);

  const payload: VibeResponse = {
    generatedAt: new Date().toISOString(),
    reddit,
    xpulse: xPack.column,
    xPulseUsage: xPack.usage,
  };

  globalForVibe.__pulsewireVibe = { at: Date.now(), payload };
  console.info(
    `[pulsewire] vibe reddit=${reddit.status}(${reddit.items.length}) x=${xPack.column.status}(${xPack.column.items.length})`
  );
  return payload;
}

export function clearVibeCacheForTests(): void {
  globalForVibe.__pulsewireVibe = undefined;
}
