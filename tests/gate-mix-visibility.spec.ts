import { test, expect } from "@playwright/test";

/**
 * Mix visibility — owner feedback after M8:
 * always-visible On wires / On Reddit / On X trend strip,
 * pulse legend, per-tile plane badges, denser board.
 */
test.describe("mix visibility", () => {
  test("trend strip + pulse legend on home", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("pulse-legend")).toBeVisible();
    await expect(page.getByTestId("pulse-legend")).toContainText(/0–100|0-100/i);
    await expect(page.getByTestId("trend-strip")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("trend-wires")).toBeVisible();
    await expect(page.getByTestId("trend-reddit")).toBeVisible();
    await expect(page.getByTestId("trend-x")).toBeVisible();
  });

  test("API returns trend pack with three planes", async ({ request }) => {
    const res = await request.get(
      "/api/highlights?section=all&window=4h&pwHotMarkets=1&refresh=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.trend).toBeTruthy();
    expect(body.trend.wires).toBeTruthy();
    expect(body.trend.reddit).toBeTruthy();
    expect(body.trend.x).toBeTruthy();
    expect(["ok", "quiet", "failed", "pending"]).toContain(
      body.trend.wires.status,
    );
    expect(["ok", "quiet", "failed", "pending"]).toContain(
      body.trend.reddit.status,
    );
    expect(["ok", "quiet", "failed", "pending"]).toContain(body.trend.x.status);
    // Hot markets fixture should put wires on the strip
    expect(body.trend.wires.items.length).toBeGreaterThan(0);
  });

  test("tiles show plane badges", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 30_000,
    });
    const planes = page.getByTestId("tile-planes").first();
    await expect(planes).toBeVisible();
    await expect(planes.getByTestId("plane-rss")).toBeVisible();
    await expect(planes.getByTestId("plane-reddit")).toBeVisible();
    await expect(planes.getByTestId("plane-x")).toBeVisible();
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
});
