/**
 * Stable publisher identity for corroboration.
 *
 * The reviewer's #1 trust failure: a cluster showed "2 sources agree" while the
 * brief listed Al Jazeera twice — one witness counted twice. Display names are
 * presentation; THIS key decides whether two feed rows are the same publisher.
 *
 * Two rows collapse to one publisher when they share a canonical key, so
 * "Al Jazeera" + "Al Jazeera English", or a direct feed + its Google News
 * syndication, count once. Genuinely different outlets (BBC vs Reuters) stay
 * distinct — that is real corroboration.
 */

/** Syndication / rename aliases → one canonical key. */
const PUBLISHER_ALIASES: Record<string, string> = {
  aljazeeraenglish: "aljazeera",
  aljazeera: "aljazeera",
  bbcnews: "bbc",
  bbc: "bbc",
  ndtvprofit: "ndtvprofit",
  economictimes: "economictimes",
  theeconomictimes: "economictimes",
  timesofindia: "timesofindia",
  thetimesofindia: "timesofindia",
  hindustantimes: "hindustantimes",
  businessline: "hindubusinessline",
  thehindubusinessline: "hindubusinessline",
  livemint: "livemint",
  mint: "livemint",
  reutersindia: "reuters",
  reuters: "reuters",
};

/**
 * Canonical publisher key. Lowercase, drop a leading "the", strip everything
 * that isn't a letter or digit, then map known name variants together.
 */
export function canonicalPublisherKey(source: string): string {
  const base = (source || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  const key = base || (source || "").trim().toLocaleLowerCase("en-US");
  return PUBLISHER_ALIASES[key] ?? key;
}

/** Count of distinct independent publishers among named sources. */
export function distinctPublisherCount(sources: { name: string }[]): number {
  const keys = new Set<string>();
  for (const s of sources) keys.add(canonicalPublisherKey(s.name));
  return keys.size;
}
