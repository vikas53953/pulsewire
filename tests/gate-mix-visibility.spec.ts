import { test, expect } from "@playwright/test";

/**
 * TREND is a dedicated chip after World — not a wall under every desk.
 * News desks stay clean (no lean mix strip, no social board).
 */
test.describe("trend panel", () => {
  test("TREND chip sits in the chip row; news desks have no social wall", async ({
    page,
  }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("chip-trend")).toBeVisible();
    await expect(page.getByTestId("chip-world")).toBeVisible();
    // Clean news desk — no under-section mix / trends wall
    await expect(page.getByTestId("trend-strip")).toHaveCount(0);
    await expect(page.getByTestId("social-trends")).toHaveCount(0);
    await expect(page.getByTestId("bento-grid")).toBeVisible();
  });

  test("TREND chip opens dedicated Reddit + X panel only", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await page.getByTestId("chip-trend").click();
    await expect(page.getByTestId("social-trends")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("social-trends-reddit")).toBeVisible();
    await expect(page.getByTestId("social-trends-x")).toBeVisible();
    // No news bento on TREND
    await expect(page.getByTestId("bento-grid")).toHaveCount(0);
    await expect(page.getByTestId("trend-strip")).toHaveCount(0);
    // Verdict hero hidden on TREND (focused panel)
    await expect(page.getByTestId("verdict-hero")).toHaveCount(0);
  });

  test("API: markets has no socialTrends; trend section has full board", async ({
    request,
  }) => {
    const mkt = await (
      await request.get(
        "/api/highlights?section=markets&window=4h&pwHotMarkets=1&refresh=1",
      )
    ).json();
    expect(mkt.socialTrends == null).toBeTruthy();
    expect(mkt.trend == null).toBeTruthy();
    expect(mkt.items.length).toBeGreaterThan(0);

    const trend = await (
      await request.get(
        "/api/highlights?section=trend&window=4h&pwHotMarkets=1&refresh=1",
      )
    ).json();
    expect(trend.section).toBe("trend");
    expect(trend.items).toEqual([]);
    expect(trend.socialTrends?.reddit?.items?.length).toBeGreaterThan(0);
    expect(trend.socialTrends?.reddit?.items?.length).toBeLessThanOrEqual(8);
  });

  test("desk chips show pulse number + color and wrap", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    const mkt = page.getByTestId("pulse-num-markets");
    await expect(mkt).toBeVisible();
    await expect(mkt).toContainText(/\d+/);
    await expect(page.getByTestId("freshness-line")).toBeVisible();
    // Wrap: chip row is flex-wrap, not a single-line scroller
    const chips = page.getByTestId("score-chips");
    await expect(chips).toHaveCSS("flex-wrap", "wrap");
  });

  test("SSR first paint includes desks, verdict, no junk chrome", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toMatch(/data-testid="verdict-hero"/);
    expect(html).toMatch(/data-testid="score-chips"/);
    expect(html).toMatch(/chip-markets/);
    expect(html).toMatch(/pulse-num-markets|data-score=/);
    expect(html).toMatch(/chip-trend/);
    expect(html).toMatch(/freshness-line/);
    expect(html).toMatch(/PulseWire/);
    expect(html).not.toMatch(/Since you left By time/);
    expect(html).not.toMatch(/Since you left Windows/);
    expect(html).not.toMatch(/>By time</);
    expect(html).not.toMatch(/data-testid="raw-sticker"/);
  });
});
