export type SectionId =
  | "all"
  | "india"
  | "markets"
  | "economy"
  | "politics"
  | "sports"
  | "world"
  | "tech"
  | "trend"
  | "xpulse"
  | "vibe"
  | "radar";

export type ContentSectionId = Exclude<
  SectionId,
  "all" | "trend" | "xpulse" | "vibe" | "radar"
>;

export type TimeWindow = "1h" | "4h" | "12h" | "24h";

export type Lens = "window" | "since";

export type TrafficLevel = "green" | "yellow" | "red";

/** SPEC v4 signal state — unlabeled EARLY is a gate-failing offense. */
export type SignalState = "early" | "building" | "confirmed";

export type PlaneId = "rss" | "reddit" | "x" | "tripwire";

export interface PlaneEvidence {
  plane: PlaneId;
  source: string;
  url?: string;
  firstSeen?: string;
}

export interface FeedConfig {
  section: ContentSectionId;
  name: string;
  url: string;
  weight: number;
  /**
   * Google News titles carry a trailing " - Publisher" / " | Publisher".
   * Direct RSS (BBC, Al Jazeera, …) must not strip — spaced em-dashes are journalism.
   */
  hasPublisherSuffix?: boolean;
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
  /** Article image from RSS media/enclosure (https) — absent → fallback tile. */
  image?: string;
}

export interface HighlightItem {
  text: string;
  sources: SourceRef[];
  publishedAt: string;
  hot: boolean;
  section?: Exclude<SectionId, "all">;
  isNew?: boolean;
  heat?: number;
  /**
   * Heat before recency multiplier — breadth/velocity/planes only.
   * Noise floor under strictSingle compares this so recency cannot create signal.
   */
  baseHeat?: number;
  velocity?: number;
  /** Earliest firstSeen across sources — when the cluster appeared. */
  firstSeen?: string;
  /** Stable id for Brief cache (hash of member raw ids). */
  clusterId?: string;
  /** Multi-plane evidence (SPEC v4 fusion). */
  evidence?: PlaneEvidence[];
  signalState?: SignalState;
  /** Official radar tripwire → confirmed by definition. */
  tripwire?: boolean;
  /** Earliest social (X/Reddit) sighting — for Brief "first seen on X". */
  firstSocialAt?: string;
  /** Heat driven primarily by unconfirmed social. */
  socialLed?: boolean;
  /** Representative article image (https) — absent → designed fallback tile. */
  image?: string;
}

export interface SectionScore {
  section: ContentSectionId;
  score: number;
  level: TrafficLevel;
  calibrating: boolean;
  /** Trusted comparable observations behind the baseline (explainability). */
  baselineSampleCount?: number;
  baselineRequired?: number;
  /** Sources unreachable — unknown ≠ quiet. */
  unknown?: boolean;
  topHeat?: number;
  topText?: string;
  /** Actual independent RSS publishers on the top story — safe to label "sources". */
  topPublisherCount?: number;
  /** Weighted cross-plane evidence strength (RSS+social) — NEVER label as sources. */
  topBreadth?: number;
  topVelocity?: number;
  topSpanMinutes?: number;
  /** Tiny heat series for 🔴 chip sparkline (newest last). */
  velocitySpark?: number[];
  /** Chip shows ⚡ when section heat is social-led (EARLY/BUILDING). */
  socialLed?: boolean;
  /** Top cluster signal state for verdict rules. */
  topSignalState?: SignalState;
  topTripwire?: boolean;
  /** Pre-saturation desk heat — for quiet % receipts (D1). */
  sectionRaw?: number;
  /** Server-computed quiet receipt line (D1) — safe for client pulseWhy. */
  quietWhy?: string | null;
}

export interface VerdictPayload {
  text: string;
  level: TrafficLevel;
  llmPolished: boolean;
  /** One-line why — action/invalidation only; never re-quotes the verdict story. */
  why?: string | null;
  /** True when feeds are unreachable — never present as quiet. */
  blind?: boolean;
  /** Desk named as the primary driver — chip row emphasis. */
  drivingSection?: ContentSectionId | null;
}

/** Always-visible mix row — one plane's trending headlines. */
export interface TrendItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  plane: "rss" | "reddit" | "x";
  section?: ContentSectionId;
  /** Lightweight “why this surfaced” for TREND (velocity / sub / age). */
  why?: string;
  /** Social velocity — drives TREND tile accent (color = status). */
  velocity?: number;
  /** Current / bucket-median velocity — when ≥14 samples (D2). */
  velocityRatio?: number | null;
}

export interface TrendPlane {
  status: "ok" | "quiet" | "failed" | "pending" | "needs_key";
  items: TrendItem[];
  note: string | null;
}

/** On wires · On Reddit · On X — lean desk mix (1–2 social). */
export interface TrendPack {
  wires: TrendPlane;
  reddit: TrendPlane;
  x: TrendPlane;
}

/** Full-page social board — all Reddit + all X across categories. */
export interface SocialTrendsPack {
  reddit: TrendPlane;
  x: TrendPlane;
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
  xPulseUsage?: {
    month: string;
    used: number;
    cap: number;
    dailyUsed?: number;
    dailyCap?: number;
    paused?: boolean;
  };
  /** M8 X governor status for footer / pause strip */
  xGovernor?: {
    dailyUsed: number;
    dailyCap: number;
    monthlyUsed: number;
    monthlyCap: number;
    paused: boolean;
    pauseNote: string | null;
  };
  /** @deprecated Lean desk mix removed from UI — kept optional for API compat. */
  trend?: TrendPack;
  /** Full Reddit + X — only populated for section=trend. */
  socialTrends?: SocialTrendsPack;
  /** Since-lens one-liner above the board (D3). */
  sinceSummary?: string | null;
  /** Rail widget: feeds reporting vs configured (honest source health). */
  sourceHealth?: { reporting: number; total: number; down: string[] };
  /** Rail widget: consecutive quiet mornings for the lead desk (null = calibrating). */
  quietStreak?: { streak: number; quietestSince: string | null } | null;
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
  { id: "trend", label: "Trend", chip: "TREND" },
  // vibe/radar kept as SectionId for API compat; chips removed in M7 UI
  { id: "vibe", label: "Vibe", chip: "VIBE" },
  { id: "xpulse", label: "X Pulse", chip: "X" },
  { id: "radar", label: "Radar", chip: "RADAR" },
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

/** Hours in a time window — used to scale recency decay. */
export function windowToHours(window: TimeWindow): number {
  return windowToMs(window) / (60 * 60 * 1000);
}

export function sectionLabel(id: ContentSectionId | string): string {
  const found = SECTIONS.find((s) => s.id === id);
  return found?.label ?? id;
}

export function sectionChip(id: ContentSectionId | string): string {
  const found = SECTIONS.find((s) => s.id === id);
  return found?.chip ?? id.slice(0, 3).toUpperCase();
}
