import { test, expect } from "@playwright/test";

/**
 * Mix visibility — desk-scoped trend only (not on ALL),
 * pulse legend, denser board. No per-tile plane badges.
 */
test.describe("mix visibility", () => {
  test("ALL has pulse legend but no trend strip", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("pulse-legend")).toBeVisible();
    await expect(page.getByTestId("pulse-legend")).toContainText(/0–100|0-100/i);
    await expect(page.getByTestId("trend-strip")).toHaveCount(0);
  });

  test("Markets chip shows section-scoped trend strip", async ({ page }) => {
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
    await expect(page.getByTestId("trend-wires")).toBeVisible();
    await expect(page.getByTestId("trend-reddit")).toBeVisible();
    await expect(page.getByTestId("trend-x")).toBeVisible();
    await expect(page.getByTestId("trend-strip")).toContainText(/Markets/i);
  });

  test("API: ALL has no trend; markets has desk-scoped pack", async ({
    request,
  }) => {
    const allRes = await request.get(
      "/api/highlights?section=all&window=4h&pwHotMarkets=1&refresh=1",
    );
    expect(allRes.ok()).toBeTruthy();
    const allBody = await allRes.json();
    expect(allBody.trend == null).toBeTruthy();

    const mkt = await request.get(
      "/api/highlights?section=markets&window=4h&pwHotMarkets=1&refresh=1",
    );
    expect(mkt.ok()).toBeTruthy();
    const body = await mkt.json();
    expect(body.trend).toBeTruthy();
    expect(body.trend.wires).toBeTruthy();
    expect(body.trend.reddit).toBeTruthy();
    expect(body.trend.x).toBeTruthy();
    expect(body.trend.wires.items.length).toBeGreaterThan(0);
    // Fixture Reddit markets signal should land on Markets desk
    expect(body.trend.reddit.status).toBe("ok");
    expect(body.trend.reddit.items.length).toBeGreaterThan(0);
    expect(body.trend.reddit.items[0].title).toMatch(/Sensex|FII|markets/i);
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

  test("switching desks changes Reddit mix", async ({ request }) => {
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
    expect(markets.trend?.reddit?.items?.[0]?.source).toMatch(/IndiaInvestments|IndianStockMarket/i);
    // Tech fixture has no tech Reddit in PW_TEST fixtures → quiet is honest
    expect(["ok", "quiet"]).toContain(tech.trend?.reddit?.status);
    if (tech.trend?.reddit?.status === "ok") {
      expect(tech.trend.reddit.items[0].source).not.toBe(
        markets.trend.reddit.items[0].source,
      );
    }
  });
});
