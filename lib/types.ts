export type SectionId =
  | "all"
  | "india"
  | "markets"
  | "economy"
  | "politics"
  | "sports"
  | "world"
  | "tech"
  | "xpulse"
  | "vibe"
  | "radar";

export type ContentSectionId = Exclude<
  SectionId,
  "all" | "xpulse" | "vibe" | "radar"
>;

export type TimeWindow = "1h" | "4h" | "12h" | "24h";

export type Lens = "window" | "since";

export type TrafficLevel = "green" | "yellow" | "red";

export interface FeedConfig {
  section: ContentSectionId;
  name: string;
  url: string;
  weight: number;
}

export interface SourceRef {
  name: string;
  url: string;
  /** When this source first carried the story (ISO). */
  firstSeen?: string;
}

export interface RawFeedItem {
  id: string;
  title: string;
  snippet: string;
  source: string;
  url: string;
  publishedAt: string;
  section: ContentSectionId | "xpulse";
}

export interface HighlightItem {
  text: string;
  sources: SourceRef[];
  publishedAt: string;
  hot: boolean;
  section?: Exclude<SectionId, "all">;
  isNew?: boolean;
  heat?: number;
  velocity?: number;
  /** Earliest firstSeen across sources — when the cluster appeared. */
  firstSeen?: string;
  /** Stable id for Brief cache (hash of member raw ids). */
  clusterId?: string;
}

export interface SectionScore {
  section: ContentSectionId;
  score: number;
  level: TrafficLevel;
  calibrating: boolean;
  topHeat?: number;
  topText?: string;
  topBreadth?: number;
  topVelocity?: number;
  topSpanMinutes?: number;
  /** Tiny heat series for 🔴 chip sparkline (newest last). */
  velocitySpark?: number[];
}

export interface VerdictPayload {
  text: string;
  level: TrafficLevel;
  llmPolished: boolean;
}

export interface HighlightsResponse {
  section: SectionId;
  window: TimeWindow;
  lens: Lens;
  generatedAt: string;
  stale: boolean;
  rawMode: boolean;
  sourcesUnreachable?: boolean;
  cacheMiss?: boolean;
  xPulseUsage?: { month: string; used: number; cap: number };
  verdict: VerdictPayload;
  scores: SectionScore[];
  items: HighlightItem[];
}

export const SECTIONS: { id: SectionId; label: string; chip: string }[] = [
  { id: "all", label: "All", chip: "ALL" },
  { id: "markets", label: "Markets", chip: "MKT" },
  { id: "india", label: "India", chip: "IND" },
  { id: "economy", label: "Economy", chip: "ECO" },
  { id: "politics", label: "Politics", chip: "POL" },
  { id: "sports", label: "Sports", chip: "SPT" },
  { id: "world", label: "World", chip: "WLD" },
  { id: "tech", label: "Tech", chip: "TEC" },
  { id: "vibe", label: "Vibe", chip: "VIBE" },
  { id: "xpulse", label: "X Pulse", chip: "X" },
  { id: "radar", label: "Radar", chip: "RADAR 📡" },
];

/** Content sections in Markets-first wedge order for chips. */
export const SCORE_CHIP_ORDER: ContentSectionId[] = [
  "markets",
  "india",
  "economy",
  "tech",
  "politics",
  "sports",
  "world",
];

export const TIME_WINDOWS: TimeWindow[] = ["1h", "4h", "12h", "24h"];

export function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

export function isTimeWindow(value: string): value is TimeWindow {
  return TIME_WINDOWS.includes(value as TimeWindow);
}

export function isLens(value: string): value is Lens {
  return value === "window" || value === "since";
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

export function sectionLabel(id: ContentSectionId | string): string {
  const found = SECTIONS.find((s) => s.id === id);
  return found?.label ?? id;
}

export function sectionChip(id: ContentSectionId | string): string {
  const found = SECTIONS.find((s) => s.id === id);
  return found?.chip ?? id.slice(0, 3).toUpperCase();
}
