export interface TripwireConfig {
  id: string;
  name: string;
  /** Public RSS or JSON URL */
  url: string;
  /** Optional title regex — if set, only matching new items trip */
  match?: RegExp;
  domain: "markets" | "tech" | "weather" | "policy";
}

/** Quietest starter set — code config only (no UI editor in v3). */
export const TRIPWIRES: TripwireConfig[] = [
  {
    id: "rbi-press",
    name: "RBI press",
    url: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
    domain: "policy",
    // HTML page — poller treats any content-hash change as a soft signal;
    // fixture mode uses explicit trip ids instead.
  },
  {
    id: "nse-circulars",
    name: "NSE circulars",
    url: "https://nsearchives.nseindia.com/content/circulars/circulars.csv",
    domain: "markets",
  },
  {
    id: "hf-blog",
    name: "Hugging Face blog",
    url: "https://huggingface.co/blog/feed.xml",
    domain: "tech",
  },
];
