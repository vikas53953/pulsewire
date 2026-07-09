import type { FeedConfig, RawFeedItem, SectionId } from "./types";

export function isTestMode(): boolean {
  return process.env.PW_TEST === "1";
}

export function isLlmFailForced(): boolean {
  return process.env.PW_LLM_FAIL === "1" || getOverrides().llmFail;
}

export function isFeedsDownForced(): boolean {
  return process.env.PW_FEEDS_DOWN === "1" || getOverrides().feedsDown;
}

export function isEmptyForced(): boolean {
  return getOverrides().empty;
}

export interface TestOverrides {
  llmFail?: boolean;
  feedsDown?: boolean;
  empty?: boolean;
}

const globalForTest = globalThis as unknown as {
  __pulsewireTestOverrides?: TestOverrides;
};

function getOverrides(): TestOverrides {
  return globalForTest.__pulsewireTestOverrides ?? {};
}

/** Request-scoped overrides for PW_TEST (honored only when PW_TEST=1). */
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
  };
}

/** Minutes ago → ISO timestamp relative to now. */
function ago(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString();
}

function item(
  section: Exclude<SectionId, "all">,
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

/**
 * Deterministic fixture pool for PW_TEST=1.
 * Ages: 10m, 50m, 3h, 9h (cross-source duplicate), 20h + section-specific fillers.
 */
export function fixtureItemsForSection(
  section: Exclude<SectionId, "all">
): RawFeedItem[] {
  if (isFeedsDownForced() || isEmptyForced()) return [];

  const sharedHotTitle =
    "RBI holds rates as inflation cools; banks lead market rebound";
  // Within 4h so default load mega tile can be 🔥
  const freshHotTitle =
    "Sensex jumps as FIIs return; banks and IT lead the rally";

  const base: RawFeedItem[] = [
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} breaking update at ten minutes`,
      10,
      "10m"
    ),
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} mid-hour market note at fifty minutes`,
      50,
      "50m"
    ),
    // Cross-source duplicate at 90m — 🔥 inside default 4h window
    item(section, "Fixture A", freshHotTitle, 90, "90m-a"),
    item(section, "Fixture B", freshHotTitle, 95, "90m-b"),
    item(
      section,
      "Fixture B",
      `${sectionLabel(section)} afternoon briefing three hours ago`,
      180,
      "3h"
    ),
    // Cross-source duplicate at 9h — must merge to 🔥; surfaces in 12h/24h
    item(section, "Fixture A", sharedHotTitle, 540, "9h-a"),
    item(section, "Fixture B", sharedHotTitle, 545, "9h-b"),
    item(
      section,
      "Fixture A",
      `${sectionLabel(section)} overnight wrap from twenty hours ago`,
      1200,
      "20h"
    ),
  ];

  // Extra fresh minors so cap-10 ranking is exercised
  for (let i = 0; i < 8; i++) {
    base.push(
      item(
        section,
        "Fixture A",
        `${sectionLabel(section)} minor wire ${i + 1} from ${12 + i} minutes ago`,
        12 + i,
        `minor-${i}`
      )
    );
  }

  return base;
}

function sectionLabel(section: string): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

/** Fixture feed configs (URLs unused when PW_TEST serves in-memory items). */
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
