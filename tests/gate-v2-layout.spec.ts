import { test, expect } from "@playwright/test";

/**
 * v2 desktop layout: clean left nav (no widgets), desk tabs + a thin
 * time/theme control at the top of the feed, and market + trends widgets in
 * the RIGHT rail (X-style). Desktop only.
 */
test.describe("v2 desktop layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "desktop layout only",
    );
  });

  test("clean nav rail + top tabs + time control", async ({ page }) => {
    await page.goto("/");

    // Desk tabs render exactly once (strict locator) and are visible.
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });

    // Left rail is nav-only: brand + refresh, no widgets duplicating the tabs.
    await expect(page.getByTestId("side-nav")).toBeVisible();
    await expect(page.getByTestId("rail-refresh")).toBeVisible();
    await expect(page.getByTestId("desk-leaderboard")).toHaveCount(0);

    // Time control lives at the top of the feed (not the rail).
    await expect(page.getByTestId("pill-4h")).toBeVisible();
  });

  test("right rail carries market snapshot + trends", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("side-nav")).toBeVisible({ timeout: 15_000 });

    // Market snapshot moved to the right rail (fixture in test mode).
    const market = page.getByTestId("market-snapshot");
    await expect(market).toBeVisible();
    await expect(market).toContainText("NIFTY");
    await expect(market).toContainText(/delayed/i);

    // Source health present, honest (test mode = full health).
    await expect(page.getByTestId("source-health")).toContainText(
      /feeds reporting/i,
    );
  });
});
