import { test, expect } from "@playwright/test";

/**
 * v2 desktop layout: desk tabs top-right, time control + clickable leaderboard
 * in the left rail. Desktop only — mobile keeps tabs + time in their original
 * positions (verified by the existing gates).
 */
test.describe("v2 desktop layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "desktop layout only",
    );
  });

  test("tabs, time, and a clickable leaderboard sit in the v2 positions", async ({
    page,
  }) => {
    await page.goto("/");

    // Tabs render exactly once (strict locator) and are visible.
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });

    // Left rail carries the brand, the relocated time control, and refresh.
    await expect(page.getByTestId("side-nav")).toBeVisible();
    await expect(page.getByTestId("pill-4h")).toBeVisible();
    await expect(page.getByTestId("rail-refresh")).toBeVisible();

    // Leaderboard moved to the rail and is now a clickable jump-to-desk.
    const leaderboard = page.getByTestId("desk-leaderboard");
    await expect(leaderboard).toBeVisible();
    await page.getByTestId("leaderboard-markets").click();
    await expect(page.getByTestId("chip-markets")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
