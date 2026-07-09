import type { FeedConfig } from "./types";

/**
 * Curated breaking / top-story feeds only.
 * Dead feeds swapped at build time are noted in implementation-notes.md.
 */
export const FEEDS: FeedConfig[] = [
  // India
  {
    section: "india",
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvnews-top-stories",
    weight: 1,
  },
  {
    section: "india",
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    weight: 1,
  },
  {
    section: "india",
    name: "Hindustan Times",
    url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    weight: 1,
  },
  {
    section: "india",
    name: "The Hindu",
    url: "https://www.thehindu.com/news/national/feeder/default.rss",
    weight: 1,
  },

  // Markets
  {
    section: "markets",
    name: "Moneycontrol",
    url: "https://www.moneycontrol.com/rss/latestnews.xml",
    weight: 1,
  },
  {
    section: "markets",
    name: "Economic Times",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    weight: 1,
  },
  {
    section: "markets",
    name: "Livemint",
    url: "https://www.livemint.com/rss/markets",
    weight: 1,
  },

  // Economy
  {
    section: "economy",
    name: "Economic Times",
    url: "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
    weight: 1,
  },
  {
    section: "economy",
    name: "Hindu Business Line",
    url: "https://www.thehindubusinessline.com/economy/?service=rss",
    weight: 1,
  },
  {
    section: "economy",
    name: "Livemint",
    url: "https://www.livemint.com/rss/economy",
    weight: 1,
  },

  // Politics
  {
    section: "politics",
    name: "The Hindu",
    url: "https://www.thehindu.com/news/national/feeder/default.rss",
    weight: 1,
  },
  {
    section: "politics",
    name: "Indian Express",
    url: "https://indianexpress.com/section/political-pulse/feed/",
    weight: 1,
  },
  {
    section: "politics",
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvnews-india-news",
    weight: 1,
  },

  // Sports
  {
    section: "sports",
    name: "ESPNcricinfo",
    url: "https://www.espncricinfo.com/rss/content/story/feeds/6.xml",
    weight: 1,
  },
  {
    section: "sports",
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms",
    weight: 1,
  },
  {
    section: "sports",
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvsports-latest",
    weight: 1,
  },

  // World
  {
    section: "world",
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    weight: 1,
  },
  {
    section: "world",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    weight: 1,
  },
  {
    section: "world",
    name: "Google News World",
    url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en",
    weight: 1,
  },

  // Tech
  {
    section: "tech",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    weight: 1,
  },
  {
    section: "tech",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    weight: 1,
  },
  {
    section: "tech",
    name: "Google News Tech",
    url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en",
    weight: 1,
  },
];

export function feedsForSection(section: FeedConfig["section"]): FeedConfig[] {
  return FEEDS.filter((f) => f.section === section);
}

export const CONTENT_SECTIONS = [
  "india",
  "markets",
  "economy",
  "politics",
  "sports",
  "world",
  "tech",
] as const;
