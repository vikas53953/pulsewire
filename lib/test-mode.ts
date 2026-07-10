import type { ContentSectionId, FeedConfig, RawFeedItem } from "./types";

export function isTestMode(): boolean {
  return process.env.PW_TEST === "1";
}

export function isLlmFailForced(): boolean {
  return process.env.PW_LLM_FAIL === "1" || Boolean(getOverrides().llmFail);
}

export function isFeedsDownForced(): boolean {
  return process.env.PW_FEEDS_DOWN === "1" || Boolean(getOverrides().feedsDown);
}

export function isEmptyForced(): boolean {
  return Boolean(getOverrides().empty);
}

/** Quiet fixture: all sections low heat → green verdict. */
export function isQuietForced(): boolean {
  return process.env.PW_QUIET === "1" || Boolean(getOverrides().quiet);
}

/** Hot Markets fixture: 5 sources within 40m → red Markets verdict. */
export function isHotMarketsForced(): boolean {
  return process.env.PW_HOT_MARKETS === "1" || Boolean(getOverrides().hotMarkets);
}

/** M7: X-only EARLY signal (no RSS match) — must label, never red alone. */
export function isEarlyXForced(): boolean {
  return process.env.PW_EARLY_X === "1" || Boolean(getOverrides().earlyX);
}

/** M7: cross-plane fusion fixture (X title matches RSS). */
export function isFusionForced(): boolean {
  return process.env.PW_FUSION === "1" || Boolean(getOverrides().fusion);
}

export interface TestOverrides {
  llmFail?: boolean;
  feedsDown?: boolean;
  empty?: boolean;
  quiet?: boolean;
  hotMarkets?: boolean;
  earlyX?: boolean;
  fusion?: boolean;
}

const globalForTest = globalThis as unknown as {
  __pulsewireTestOverrides?: TestOverrides;
};

function getOverrides(): TestOverrides {
  return globalForTest.__pulsewireTestOverrides ?? {};
}

export function setTestOverrides(overrides: TestOverrides): void {
  if (!isTestMode()) return;
  globalForTest.__pulsewireTestOverrides = { ...overrides };
}

export function clearTestOverrides(): void {
  globalForTest.__pulsewireTestOverrides = {};
}

export function parseTestOverrides(searchParams: URLSearchParams): TestOverrides {
  if (!isTestMode()) return {};
  return {
    llmFail: searchParams.get("pwLlmFail") === "1",
    feedsDown: searchParams.get("pwFeedsDown") === "1",
    empty: searchParams.get("pwEmpty") === "1",
    quiet: searchParams.get("pwQuiet") === "1",
    hotMarkets: searchParams.get("pwHotMarkets") === "1",
    earlyX: searchParams.get("pwEarlyX") === "1",
    fusion: searchParams.get("pwFusion") === "1",
  };
}

function ago(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString();
}

function item(
  section: ContentSectionId,
  source: string,
  title: string,
  minutesAgo: number,
  slug: string
): RawFeedItem {
  const publishedAt = ago(minutesAgo);
  const url = `https://fixture.pulsewire.test/${section}/${slug}`;
  return {
    id: `${section}-${source}-${slug}`.replace(/\s+/g, "-").toLowerCase(),
    title,
    snippet: title,
    source,
    url,
    publishedAt,
    section,
  };
}

function quietItems(section: ContentSectionId): RawFeedItem[] {
  // Single weak source, old — low heat
  return [
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} routine overnight note with little market impact across desks`,
      600,
      "quiet-1"
    ),
  ];
}

function hotMarketsItems(): RawFeedItem[] {
  const title =
    "RBI shock rate hold sparks bank rally as Sensex futures jump after inflation cools";
  // 5 sources firstSeen within ~40 minutes → high velocity
  return [
    item("markets", "Fixture A", title, 40, "hot-a"),
    item("markets", "Fixture B", title, 35, "hot-b"),
    item("markets", "Fixture C", title, 28, "hot-c"),
    item("markets", "Fixture D", title, 18, "hot-d"),
    item("markets", "Fixture E", title, 5, "hot-e"),
    // Age-diversity fillers for 4h
    item(
      "markets",
      "Fixture A",
      "Markets afternoon briefing three hours ago as FIIs trim positions quietly",
      180,
      "3h"
    ),
    item(
      "markets",
      "Fixture A",
      "Markets overnight wrap from twenty hours ago after global cues mixed",
      1200,
      "20h"
    ),
    item(
      "markets",
      "Fixture A",
      "Markets mid-window note at ninety minutes as rupee holds steady vs dollar",
      90,
      "90m"
    ),
  ];
}

/**
 * Deterministic fixture pool for PW_TEST=1.
 */
export function fixtureItemsForSection(
  section: ContentSectionId
): RawFeedItem[] {
  if (isFeedsDownForced() || isEmptyForced()) return [];
  if (isQuietForced()) return quietItems(section);

  if (isHotMarketsForced()) {
    if (section === "markets") return hotMarketsItems();
    return quietItems(section);
  }

  const sharedHotTitle =
    "RBI holds rates as inflation cools; banks lead market rebound across Asia";
  const freshHotTitle =
    "Sensex jumps as FIIs return; banks and IT lead the rally after RBI hold";

  const base: RawFeedItem[] = [
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} breaking update at ten minutes as traders watch rupee and yields`,
      10,
      "10m"
    ),
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} mid-hour market note at fifty minutes with thin volumes`,
      50,
      "50m"
    ),
    item(section, "Fixture A", freshHotTitle, 90, "90m-a"),
    item(section, "Fixture B", freshHotTitle, 95, "90m-b"),
    item(
      section,
      "Fixture B",
      `${sectionLabel(section)} afternoon briefing three hours ago after global cues mixed`,
      180,
      "3h"
    ),
    item(section, "Fixture A", sharedHotTitle, 540, "9h-a"),
    item(section, "Fixture B", sharedHotTitle, 545, "9h-b"),
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} overnight wrap from twenty hours ago as Asia closed mixed`,
      1200,
      "20h-a"
    ),
    item(
      section,
      "Fixture B",
      `${sectionLabel(section)} overnight wrap from twenty hours ago as Asia closed mixed`,
      1210,
      "20h-b"
    ),
  ];

  for (let i = 0; i < 4; i++) {
    base.push(
      item(
        section,
        "Fixture A",
        `${sectionLabel(section)} minor wire ${i + 1} from ${12 + i} minutes ago with limited follow-through`,
        12 + i,
        `minor-${i}`
      )
    );
  }

  // Batch C2 adversarial pack — hyphenated titles, age ladder, entities, long line.
  // Empty titles are omitted here; feed-engine already drops them on live paths.
  base.push(
    item(
      section,
      "Fixture A",
      "Ex-RBI governor flags inflation risk after policy meet",
      120, // 2h
      "adv-exrbi",
    ),
    item(
      section,
      "Fixture A",
      "Modi-Putin call covers trade and energy ties across desks",
      360, // 6h
      "adv-modi",
    ),
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} mid-day briefing at thirteen hours as desks recalibrate positions`,
      780, // 13h
      "adv-13h",
    ),
    item(
      section,
      "Fixture B",
      `${sectionLabel(section)} late wrap at twenty-two hours after the global close settled`,
      1320, // 22h
      "adv-22h",
    ),
    item(
      section,
      "Fixture A",
      "US-China talks stall over semiconductor export rules this week",
      150,
      "adv-us-china",
    ),
    item(
      section,
      "Fixture A",
      // Decoded form — fixtures skip stripHtml; live path decodes &amp; etc.
      "Paramount-Skydance deal clears another regulatory hurdle in Delhi",
      200,
      "adv-paramount",
    ),
    item(
      section,
      "Fixture A",
      `${"Long adversarial headline that keeps going so layout cannot choke on a three-hundred-character wire dump from a noisy feed that forgot to edit. ".repeat(3)}`.slice(
        0,
        300,
      ),
      210,
      "adv-long",
    ),
  );

  return base;
}

function sectionLabel(section: string): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

export function fixtureFeeds(): FeedConfig[] {
  const sections = [
    "india",
    "markets",
    "economy",
    "politics",
    "sports",
    "world",
    "tech",
  ] as const;

  const feeds: FeedConfig[] = [];
  for (const section of sections) {
    feeds.push(
      {
        section,
        name: "Fixture A",
        url: `fixture://${section}/a.xml`,
        weight: 1,
      },
      {
        section,
        name: "Fixture B",
        url: `fixture://${section}/b.xml`,
        weight: 1,
      }
    );
  }
  return feeds;
}
