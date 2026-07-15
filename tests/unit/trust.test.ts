import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyLlmHighlights,
  clusterBySimilarity,
  clustersToRawHighlights,
} from "@/lib/merge";
import { filterSince } from "@/lib/rank";
import { scoreSection } from "@/lib/score";
import { pulseWhy } from "@/lib/copy";
import { canonicalPublisherKey, distinctPublisherCount } from "@/lib/publisher";
import { getBrief, resetBriefsForTests } from "@/lib/brief";
import { extractImage } from "@/lib/feed-engine";
import type { HighlightItem, RawFeedItem } from "@/lib/types";

const PUBLISHED = "2026-07-14T12:00:00.000Z";

function raw(
  id: string,
  source: string,
  url: string,
  title: string,
): RawFeedItem {
  return {
    id,
    title,
    snippet: "",
    source,
    url,
    publishedAt: PUBLISHED,
    section: "world",
  };
}

describe("independent-source agreement (reviewer trust failure #1)", () => {
  const title = "UN warns Gaza fuel shortage is worsening";

  it("collapses one publisher's two feed rows to a single source", () => {
    const items = [
      raw("aj-direct", "Al Jazeera", "https://aljazeera.com/gaza", title),
      raw(
        "aj-google",
        "Al Jazeera English",
        "https://news.google.com/aj-copy",
        "UN warns Gaza fuel shortage worsening",
      ),
    ];
    const [highlight] = clustersToRawHighlights(clusterBySimilarity(items), 10);
    expect(highlight.sources).toHaveLength(1);
    expect(highlight.hot).toBe(false);
  });

  it("keeps genuinely different publishers as real corroboration", () => {
    const items = [
      raw("bbc", "BBC News", "https://bbc.com/gaza", title),
      raw("aj", "Al Jazeera", "https://aljazeera.com/gaza", title),
    ];
    const [highlight] = clustersToRawHighlights(clusterBySimilarity(items), 10);
    expect(highlight.sources).toHaveLength(2);
    expect(highlight.hot).toBe(true);
  });

  it("overrides an LLM merged flag when every row is one publisher", () => {
    const items = [
      raw("aj-1", "Al Jazeera", "https://aljazeera.com/gaza", title),
      raw("aj-2", "Al Jazeera English", "https://news.google.com/aj", title),
    ];
    const clusters = clusterBySimilarity(items);
    const [highlight] = applyLlmHighlights(
      clusters,
      [{ ids: items.map((i) => i.id), text: title, merged: true }],
      10,
    );
    expect(highlight.sources).toHaveLength(1);
    expect(highlight.hot).toBe(false);
  });

  it("canonical key folds aliases and Google-News renames together", () => {
    expect(canonicalPublisherKey("Al Jazeera")).toBe(
      canonicalPublisherKey("Al Jazeera English"),
    );
    expect(canonicalPublisherKey("The Economic Times")).toBe(
      canonicalPublisherKey("Economic Times"),
    );
    expect(canonicalPublisherKey("BBC")).not.toBe(
      canonicalPublisherKey("Reuters"),
    );
    expect(
      distinctPublisherCount([{ name: "BBC" }, { name: "BBC News" }]),
    ).toBe(1);
  });
});

describe("pulse explainability separates publishers from weighted breadth", () => {
  it("labels the receipt with publishers, never weighted cross-plane heat", () => {
    const item: HighlightItem = {
      text: "RBI keeps the policy rate unchanged",
      sources: [
        { name: "Reuters", url: "https://reuters.com/rbi", firstSeen: PUBLISHED },
      ],
      evidence: [
        { plane: "rss", source: "Reuters", url: "https://reuters.com/rbi", firstSeen: PUBLISHED },
        { plane: "reddit", source: "r/IndiaInvestments", url: "https://reddit.com/x", firstSeen: PUBLISHED },
      ],
      publishedAt: PUBLISHED,
      signalState: "confirmed",
      hot: false,
      section: "economy",
    };
    const s = scoreSection("economy", [item], Date.parse(PUBLISHED) + 60_000, {
      persistHistory: false,
    });
    // Weighted breadth (1.0 + 0.6 = 1.6) must NOT masquerade as 2 publishers.
    expect(s.topPublisherCount).toBe(1);
    expect(s.topBreadth ?? 0).toBeGreaterThan(1);
    const why = pulseWhy(s);
    expect(why).toContain("1 source");
    expect(why).not.toMatch(/2 sources/);
  });
});

describe("Since-last-visit boundary fails closed (reviewer #3/#4)", () => {
  const items: HighlightItem[] = [
    {
      text: "Old story",
      sources: [{ name: "BBC", url: "https://bbc.com/a", firstSeen: PUBLISHED }],
      publishedAt: PUBLISHED,
      firstSeen: PUBLISHED,
      hot: false,
    },
  ];

  it("returns nothing (not the whole pool) for an invalid boundary", () => {
    expect(filterSince(items, "not-a-date")).toEqual([]);
  });

  it("still filters correctly for a valid boundary", () => {
    const before = Date.parse("2026-07-14T11:00:00.000Z");
    const after = Date.parse("2026-07-14T13:00:00.000Z");
    expect(filterSince(items, new Date(before).toISOString())).toHaveLength(1);
    expect(filterSince(items, new Date(after).toISOString())).toHaveLength(0);
  });
});

describe("RSS image extraction (v2 image tiles)", () => {
  it("reads media:content, upgrading http → https", () => {
    expect(
      extractImage({
        mediaContent: [{ $: { url: "http://cdn.site/a.jpg", medium: "image" } }],
      }),
    ).toBe("https://cdn.site/a.jpg");
  });

  it("falls back to media:thumbnail, then enclosure", () => {
    expect(
      extractImage({ mediaThumbnail: { $: { url: "https://cdn.site/t.jpg" } } }),
    ).toBe("https://cdn.site/t.jpg");
    expect(
      extractImage({ enclosure: { url: "https://cdn.site/e.png", type: "image/png" } }),
    ).toBe("https://cdn.site/e.png");
  });

  it("pulls the first <img> from content:encoded", () => {
    expect(
      extractImage({
        contentEncoded: '<p>hi</p><img src="https://cdn.site/body.webp" alt="x">',
      }),
    ).toBe("https://cdn.site/body.webp");
  });

  it("returns null when there is no usable image (→ fallback tile)", () => {
    expect(extractImage({})).toBeNull();
    // Non-image enclosure (podcast audio) must not become a picture.
    expect(
      extractImage({ enclosure: { url: "https://cdn.site/ep.mp3", type: "audio/mpeg" } }),
    ).toBeNull();
  });
});

describe("Brief honesty (reviewer #2): reduced view is not a cached result", () => {
  beforeEach(() => resetBriefsForTests());
  afterEach(() => resetBriefsForTests());

  it("never caches a raw/sources-only fallback as a completed brief", async () => {
    const input = {
      clusterId: "trust-raw-brief",
      title: "RBI keeps the policy rate unchanged",
      sources: [{ name: "Reuters", url: "https://reuters.com/rbi" }],
      forceRaw: true,
    };
    const first = await getBrief(input);
    const second = await getBrief(input);
    expect(first.rawMode).toBe(true);
    expect(first.cached).toBe(false);
    // A regenerable capability gap — not a stored answer served back as cached.
    expect(second.rawMode).toBe(true);
    expect(second.cached).toBe(false);
  });
});
