export type SectionId =
  | "all"
  | "india"
  | "markets"
  | "economy"
  | "politics"
  | "sports"
  | "world"
  | "tech";

export type TimeWindow = "1h" | "4h" | "12h" | "24h";

export interface FeedConfig {
  section: Exclude<SectionId, "all">;
  name: string;
  url: string;
  weight: number;
}

export interface SourceRef {
  name: string;
  url: string;
}

export interface RawFeedItem {
  id: string;
  title: string;
  snippet: string;
  source: string;
  url: string;
  publishedAt: string;
  section: Exclude<SectionId, "all">;
}

export interface HighlightItem {
  text: string;
  sources: SourceRef[];
  publishedAt: string;
  hot: boolean;
  /** Present on All-tab items so the tile can show which section it came from. */
  section?: Exclude<SectionId, "all">;
}

export interface HighlightsResponse {
  section: SectionId;
  window: TimeWindow;
  generatedAt: string;
  stale: boolean;
  rawMode: boolean;
  sourcesUnreachable?: boolean;
  /** True when this response forced a cache rebuild (?refresh=1 / cold miss). */
  cacheMiss?: boolean;
  items: HighlightItem[];
}

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "india", label: "India" },
  { id: "markets", label: "Markets" },
  { id: "economy", label: "Economy" },
  { id: "politics", label: "Politics" },
  { id: "sports", label: "Sports" },
  { id: "world", label: "World" },
  { id: "tech", label: "Tech" },
];

export const TIME_WINDOWS: TimeWindow[] = ["1h", "4h", "12h", "24h"];

export function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

export function isTimeWindow(value: string): value is TimeWindow {
  return TIME_WINDOWS.includes(value as TimeWindow);
}

export function windowToMs(window: TimeWindow): number {
  switch (window) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "12h":
      return 12 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
  }
}
