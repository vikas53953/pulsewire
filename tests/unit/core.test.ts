import { describe, expect, it } from "vitest";
import { pulseWhy } from "@/lib/copy";
import { suppressNoise, dedupeBoard } from "@/lib/rank";
import { isSafeHttpUrl, sanitizeHttpUrl } from "@/lib/safe-url";
import { storyHeat, trafficLevel, saturateScore } from "@/lib/score";
import { isLikelyDuplicate } from "@/lib/similarity";
import { buildVerdictTemplate, verdictWhy } from "@/lib/verdict";
import { median, mad } from "@/lib/baseline";
import type { HighlightItem, SectionScore } from "@/lib/types";

function score(
  partial: Partial<SectionScore> & Pick<SectionScore, "section" | "score" | "level">
): SectionScore {
  return {
    calibrating: false,
    ...partial,
  };
}

describe("safe-url", () => {
  it("allowlists http/https only", () => {
    expect(isSafeHttpUrl("https://example.com/a")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/a")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,hi")).toBe(false);
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
  });
});

describe("similarity", () => {
  it("detects same-event titles", () => {
    expect(
      isLikelyDuplicate(
        "Sensex plunges 800 points on FII selloff",
        "Sensex plunges 800 points as FII selloff continues",
        0.6,
      ),
    ).toBe(true);
  });
});

describe("baseline math", () => {
  it("median and mad", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(mad([1, 2, 3, 4, 5], 3)).toBe(1);
  });
});

describe("score", () => {
  it("traffic bands", () => {
    expect(trafficLevel(10)).toBe("green");
    expect(trafficLevel(40)).toBe("yellow");
    expect(trafficLevel(70)).toBe("red");
  });

  it("saturateScore caps at 100", () => {
    expect(saturateScore(0)).toBe(0);
    expect(saturateScore(999)).toBeLessThanOrEqual(100);
  });

  it("storyHeat rises with breadth and velocity", () => {
    const thin = storyHeat({ breadth: 1, velocity: 1, ageHours: 2 });
    const fat = storyHeat({ breadth: 5, velocity: 4, ageHours: 0.5 });
    expect(fat).toBeGreaterThan(thin);
  });
});

describe("rank noise floor", () => {
  const item = (
    text: string,
    heat: number,
    breadth: number,
    extra?: Partial<HighlightItem>,
  ): HighlightItem => ({
    text,
    sources: Array.from({ length: breadth }, (_, i) => ({
      name: `S${i}`,
      url: `https://example.com/${i}`,
    })),
    publishedAt: new Date().toISOString(),
    hot: heat > 20,
    heat,
    ...extra,
  });

  it("drops thin single-source items below soft floor", () => {
    const kept = suppressNoise([
      item("Big multi-source move on Sensex", 80, 4),
      item("Tiny single-source note about a sidebar", 2, 1),
    ]);
    expect(kept.map((i) => i.text)).toEqual([
      "Big multi-source move on Sensex",
    ]);
  });

  it("keeps early/building social even when heat is low", () => {
    const kept = suppressNoise([
      item("Wire cluster", 50, 3),
      item("Early social blip", 1, 1, { signalState: "early" }),
    ]);
    expect(kept.some((i) => i.signalState === "early")).toBe(true);
  });

  it("does not keep a recency-boosted single-source alone as if it were hot", () => {
    // Exact Soft-ship regression class: one thin source with modest heat
    // under a much hotter top item must die at the floor.
    const kept = suppressNoise([
      item("Confirmed multi-desk cluster", 90, 5),
      item("Recency-boosted single outlet blurb", 8, 1),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].text).toContain("Confirmed");
  });

  it("dedupeBoard keeps hottest copy of same story", () => {
    const out = dedupeBoard([
      item("Sensex plunges 800 points on FII selloff", 40, 2),
      item("Sensex plunges 800 points as FII selloff continues", 70, 3),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].heat).toBe(70);
  });
});

describe("verdict templates", () => {
  const desks = (
    rows: Array<Partial<SectionScore> & Pick<SectionScore, "section" | "score" | "level">>
  ) => rows.map(score);

  it("all green → quiet win", () => {
    const v = buildVerdictTemplate({
      scores: desks([
        { section: "markets", score: 12, level: "green" },
        { section: "economy", score: 8, level: "green" },
        { section: "politics", score: 5, level: "green" },
        { section: "india", score: 10, level: "green" },
        { section: "sports", score: 4, level: "green" },
        { section: "world", score: 6, level: "green" },
        { section: "tech", score: 7, level: "green" },
      ]),
      lens: "window",
    });
    expect(v.level).toBe("green");
    expect(v.text).toMatch(/All quiet/i);
    expect(v.blind).toBeFalsy();
  });

  it("all yellow → computed lead, not hardcoded Mostly quiet", () => {
    const v = buildVerdictTemplate({
      scores: desks([
        {
          section: "markets",
          score: 45,
          level: "yellow",
          topText: "Sensex drops on FII flows",
          topBreadth: 3,
        },
        {
          section: "economy",
          score: 42,
          level: "yellow",
          topText: "Rupee slips versus dollar",
          topBreadth: 2,
        },
        {
          section: "politics",
          score: 40,
          level: "yellow",
          topText: "Parliament debate on bill",
          topBreadth: 2,
        },
        { section: "india", score: 38, level: "yellow", topText: "Flood alert" },
        { section: "sports", score: 36, level: "yellow", topText: "Match delayed" },
        { section: "world", score: 35, level: "yellow", topText: "Summit talks" },
        { section: "tech", score: 34, level: "yellow", topText: "App outage" },
      ]),
      lens: "window",
    });
    expect(v.level).toBe("yellow");
    expect(v.text).not.toMatch(/^Mostly quiet/i);
    expect(v.text).toMatch(/Broadly warming|Mixed/i);
  });

  it("blind ≠ quiet", () => {
    const v = buildVerdictTemplate({
      scores: desks([
        { section: "markets", score: 0, level: "green", unknown: true },
      ]),
      lens: "window",
      sourcesUnreachable: true,
    });
    expect(v.blind).toBe(true);
    expect(v.level).toBe("yellow");
    expect(v.text).toMatch(/Sources unreachable/i);
    expect(v.text).not.toMatch(/All quiet/i);
  });

  it("same-event merge across yellow desks", () => {
    const v = buildVerdictTemplate({
      scores: desks([
        {
          section: "markets",
          score: 48,
          level: "yellow",
          topText: "Sensex plunges 800 points on FII selloff",
          topBreadth: 4,
        },
        {
          section: "economy",
          score: 44,
          level: "yellow",
          topText: "Sensex plunges 800 points as FII selloff continues",
          topBreadth: 3,
        },
        { section: "politics", score: 10, level: "green" },
        { section: "india", score: 8, level: "green" },
        { section: "sports", score: 5, level: "green" },
        { section: "world", score: 6, level: "green" },
        { section: "tech", score: 7, level: "green" },
      ]),
      lens: "window",
    });
    expect(v.text).toMatch(/same story/i);
    expect(v.text).toMatch(/Markets/i);
    expect(v.text).toMatch(/Economy/i);
  });
});

describe("chip why invariant", () => {
  it("a desk why never names another desk's story", () => {
    const markets = score({
      section: "markets",
      score: 55,
      level: "yellow",
      topText: "Sensex plunges on FII selloff",
      topBreadth: 3,
    });
    const politics = score({
      section: "politics",
      score: 50,
      level: "yellow",
      topText: "Parliament clears farm bill",
      topBreadth: 2,
    });

    const mWhy = pulseWhy(markets);
    const pWhy = pulseWhy(politics);
    expect(mWhy).toMatch(/Markets/);
    expect(mWhy).toMatch(/Sensex/i);
    expect(mWhy).not.toMatch(/Parliament|farm bill/i);
    expect(pWhy).toMatch(/Politics/);
    expect(pWhy).toMatch(/Parliament|farm/i);
    expect(pWhy).not.toMatch(/Sensex/i);

    const vWhy = verdictWhy(markets);
    expect(vWhy).toBeTruthy();
    expect(vWhy!).toMatch(/Markets/i);
    expect(vWhy!).not.toMatch(/Parliament|farm bill/i);
  });
});
