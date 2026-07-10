import Parser from "rss-parser";
import { REDDIT_SUBS } from "./reddit.config";
import { isFeedsDownForced, isTestMode } from "./test-mode";
import type { ContentSectionId } from "./types";
import type { SocialSignal } from "./fusion";

const parser = new Parser({
  timeout: 8_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; PulseWire/0.4; +https://github.com/vikas53953/pulsewire)",
    Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
  },
});

const globalForReddit = globalThis as unknown as {
  __pulsewireRedditSignals?: { at: number; signals: SocialSignal[] };
};

function fixtureSignals(): SocialSignal[] {
  const now = Date.now();
  return [
    {
      plane: "reddit",
      title: "Sensex futures jump as FIIs return — Reddit markets desk",
      url: "https://www.reddit.com/r/IndiaInvestments/comments/fixture1",
      source: "r/IndiaInvestments",
      publishedAt: new Date(now - 20 * 60_000).toISOString(),
      section: "markets",
      velocity: 5,
    },
    {
      plane: "reddit",
      title: "RBI hold thread: what desks are watching tonight",
      url: "https://www.reddit.com/r/india/comments/fixture2",
      source: "r/india",
      publishedAt: new Date(now - 45 * 60_000).toISOString(),
      section: "india",
      velocity: 3,
    },
  ];
}

async function fetchSub(sub: (typeof REDDIT_SUBS)[number]): Promise<SocialSignal[]> {
  const parsed = await parser.parseURL(sub.url);
  return (parsed.items || []).slice(0, 8).map((item, idx) => {
    const link = item.link || item.guid || "";
    const publishedAt =
      item.isoDate ||
      (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());
    // Velocity proxy: fresher + higher in feed = higher velocity
    const ageH = Math.max(
      0.1,
      (Date.now() - new Date(publishedAt).getTime()) / 3_600_000,
    );
    const velocity = Math.max(0.5, (8 - idx) / ageH);
    return {
      plane: "reddit" as const,
      title: (item.title || "").trim(),
      url: link.startsWith("http") ? link : `https://www.reddit.com${link}`,
      source: `r/${sub.sub}`,
      publishedAt,
      section: sub.sections[0],
      velocity,
    };
  }).filter((s) => s.title && s.url);
}

/**
 * Reddit plane snapshot for fusion (SPEC v4 §5).
 * Free continuous poll — never burns x_search.
 */
export async function getRedditSignals(opts?: {
  forceRefresh?: boolean;
}): Promise<SocialSignal[]> {
  const hit = globalForReddit.__pulsewireRedditSignals;
  // Never treat an empty cache as fresh — empty often means a cold/failed pass.
  if (
    !opts?.forceRefresh &&
    hit &&
    hit.signals.length > 0 &&
    Date.now() - hit.at < 10 * 60_000
  ) {
    return hit.signals;
  }

  if (isTestMode()) {
    const signals = fixtureSignals();
    globalForReddit.__pulsewireRedditSignals = { at: Date.now(), signals };
    return signals;
  }
  if (isFeedsDownForced()) {
    return [];
  }

  const results = await Promise.allSettled(REDDIT_SUBS.map((s) => fetchSub(s)));
  const signals: SocialSignal[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") {
      if (r.status === "rejected") {
        console.warn(
          `[pulsewire] reddit-plane sub fail: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
        );
      }
      continue;
    }
    for (const s of r.value) {
      const key = s.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push(s);
    }
  }

  // Only cache non-empty — keep retrying on the next request if quiet/failed.
  if (signals.length > 0) {
    globalForReddit.__pulsewireRedditSignals = { at: Date.now(), signals };
  }
  console.info(`[pulsewire] reddit-plane signals=${signals.length}`);
  return signals;
}

export function clearRedditSignalsForTests(): void {
  globalForReddit.__pulsewireRedditSignals = undefined;
}

export function signalsForSection(
  signals: SocialSignal[],
  section: ContentSectionId,
): SocialSignal[] {
  return signals.filter(
    (s) => !s.section || s.section === section || section === "india",
  );
}
