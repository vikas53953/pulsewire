import { test, expect } from "@playwright/test";

/**
 * Mix + full social trends:
 * - lean desk mix (1–2 Reddit/X)
 * - full Trends board (all Reddit + all X, all categories)
 * - no duplicacy between mix and full board
 */
test.describe("mix visibility", () => {
  test("ALL has pulse legend, no lean mix, has full social trends", async ({
    page,
  }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("pulse-legend")).toBeVisible();
    await expect(page.getByTestId("trend-strip")).toHaveCount(0);
    await expect(page.getByTestId("social-trends")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("social-trends-reddit")).toBeVisible();
    await expect(page.getByTestId("social-trends-x")).toBeVisible();
  });

  test("Markets chip shows lean mix + full trends", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("chip-markets")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("trend-strip")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("trend-strip")).toHaveAttribute(
      "data-section",
      "markets",
    );
    await expect(page.getByTestId("social-trends")).toBeVisible();
  });

  test("API: lean mix ≤2 social; full Reddit is larger and deduped", async ({
    request,
  }) => {
    const mkt = await request.get(
      "/api/highlights?section=markets&window=4h&pwHotMarkets=1&refresh=1",
    );
    expect(mkt.ok()).toBeTruthy();
    const body = await mkt.json();

    expect(body.trend).toBeTruthy();
    expect(body.trend.reddit.items.length).toBeGreaterThan(0);
    expect(body.trend.reddit.items.length).toBeLessThanOrEqual(2);
    expect(body.trend.x.items.length).toBeLessThanOrEqual(2);

    expect(body.socialTrends).toBeTruthy();
    expect(body.socialTrends.reddit.status).toBe("ok");
    expect(body.socialTrends.reddit.items.length).toBeGreaterThan(
      body.trend.reddit.items.length,
    );
    // Full board spans multiple categories / subs
    const sources = new Set(
      body.socialTrends.reddit.items.map((i: { source: string }) => i.source),
    );
    expect(sources.size).toBeGreaterThan(1);

    // No URL overlap between mix Reddit and full Reddit
    const mixUrls = new Set(
      body.trend.reddit.items.map((i: { url: string }) => i.url),
    );
    for (const item of body.socialTrends.reddit.items) {
      expect(mixUrls.has(item.url)).toBe(false);
    }
  });

  test("ALL API returns full social trends across categories", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/highlights?section=all&window=4h&pwHotMarkets=1&refresh=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.trend == null).toBeTruthy();
    expect(body.socialTrends?.reddit?.items?.length).toBeGreaterThanOrEqual(5);
  });

  test("tiles do not show plane badges — source line is enough", async ({
    page,
  }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("tile-planes")).toHaveCount(0);
    await expect(page.getByTestId("tile-evidence").first()).toBeVisible();
  });

  test("board can exceed old 9-item cap under hot fixture", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/highlights?section=markets&window=4h&pwHotMarkets=1&pwLlmFail=1&refresh=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items.length).toBeLessThanOrEqual(16);
  });

  test("switching desks changes lean Reddit mix", async ({ request }) => {
    const markets = await (
      await request.get(
        "/api/highlights?section=markets&window=4h&pwHotMarkets=1&refresh=1",
      )
    ).json();
    const tech = await (
      await request.get(
        "/api/highlights?section=tech&window=4h&pwHotMarkets=1&refresh=1",
      )
    ).json();
    expect(markets.trend?.reddit?.items?.[0]?.source).toMatch(
      /IndiaInvestments|IndianStockMarket/i,
    );
    expect(["ok", "quiet"]).toContain(tech.trend?.reddit?.status);
    if (tech.trend?.reddit?.status === "ok") {
      expect(tech.trend.reddit.items[0].source).not.toBe(
        markets.trend.reddit.items[0].source,
      );
    }
  });
});
