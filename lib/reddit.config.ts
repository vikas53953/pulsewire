import type { ContentSectionId } from "./types";

export type RedditSubConfig = {
  sub: string;
  /** Sections this sub can signal into */
  sections: ContentSectionId[];
  /** Atom/RSS URL (OAuth JSON deferred — RSS works from this host). */
  url: string;
};

/**
 * Curated Reddit plane — editable. Warmer polls these every CACHE_TTL.
 * Signal = velocity above sub baseline (M7: score proxy via recency rank).
 */
export const REDDIT_SUBS: RedditSubConfig[] = [
  {
    sub: "IndiaInvestments",
    sections: ["markets", "economy", "india"],
    url: "https://www.reddit.com/r/IndiaInvestments/.rss",
  },
  {
    sub: "IndianStockMarket",
    sections: ["markets", "economy"],
    url: "https://www.reddit.com/r/IndianStockMarket/.rss",
  },
  {
    sub: "india",
    sections: ["india", "politics", "world"],
    url: "https://www.reddit.com/r/india/.rss",
  },
  {
    sub: "IndiaSpeaks",
    sections: ["india", "politics"],
    url: "https://www.reddit.com/r/IndiaSpeaks/.rss",
  },
  {
    sub: "technology",
    sections: ["tech"],
    url: "https://www.reddit.com/r/technology/.rss",
  },
  {
    sub: "Cricket",
    sections: ["sports"],
    url: "https://www.reddit.com/r/Cricket/.rss",
  },
  {
    sub: "worldnews",
    sections: ["world", "politics"],
    url: "https://www.reddit.com/r/worldnews/.rss",
  },
  {
    sub: "geopolitics",
    sections: ["world", "politics"],
    url: "https://www.reddit.com/r/geopolitics/.rss",
  },
];

export function subsForSection(section: ContentSectionId): RedditSubConfig[] {
  return REDDIT_SUBS.filter((s) => s.sections.includes(section));
}
