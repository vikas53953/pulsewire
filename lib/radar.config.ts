export interface TripwireConfig {
  id: string;
  name: string;
  /** Public RSS / Atom URL (HTML pages are too noisy — not used). */
  url: string;
  /** Optional title regex — if set, only matching new items trip */
  match?: RegExp;
  domain: "markets" | "tech" | "weather" | "policy";
  /** Plain-English what this watch means */
  blurb: string;
}

/**
 * Starter tripwires — real RSS only.
 * A trip = a *new* item appeared since last poll (first poll only baselines).
 */
export const TRIPWIRES: TripwireConfig[] = [
  {
    id: "sebi-press",
    name: "SEBI releases",
    url: "https://www.sebi.gov.in/sebirss.xml",
    domain: "policy",
    blurb: "New SEBI press / circular headline.",
  },
  {
    id: "hf-blog",
    name: "Hugging Face blog",
    url: "https://huggingface.co/blog/feed.xml",
    domain: "tech",
    blurb: "New post on the Hugging Face blog.",
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    domain: "markets",
    blurb: "New BBC Business headline (global markets desk).",
  },
];
