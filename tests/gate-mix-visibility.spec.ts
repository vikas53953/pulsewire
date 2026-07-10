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
    expect(trend.socialTrends?.reddit?.items?.length).toBeGreaterThanOrEqual(5);
  });

  test("SSR first paint includes verdict and score chips (not empty shell)", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    // Must not be an empty client shell — reviewers fetch without waiting on JS.
    expect(html).toMatch(/data-testid="verdict-hero"|data-testid="score-chips"/);
    expect(html).toMatch(/chip-markets|MKT/);
    expect(html).not.toMatch(/Since you left Windows/);
    expect(html).toMatch(/By time/);
  });
});
