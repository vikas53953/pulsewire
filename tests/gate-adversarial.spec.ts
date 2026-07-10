import { expect, test } from "@playwright/test";
import { LAST_VISIT_KEY } from "../lib/last-visit";

/**
 * Batch C2 — adversarial PW_TEST pool, reader-POV invariants.
 * Hyphenated titles, age ladder, long headlines; never stub tiles.
 */
test.describe("adversarial fixture pack", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop once");
  });

  test("no tile title under 15 chars; hyphenated headlines survive", async ({
    page,
  }) => {
    await page.goto("/?refresh=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 30_000,
    });
    const texts = page.getByTestId("tile-text");
    const n = await texts.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const t = ((await texts.nth(i).textContent()) || "").trim();
      expect(t.length).toBeGreaterThanOrEqual(15);
      expect(t).not.toMatch(/^(Ex|Modi|US|Paramount)$/);
    }
    // Hyphenated corpus must appear somewhere on a desk or ALL
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/Ex-RBI|Modi-Putin|US-China|Paramount-Skydance/);
  });

  test("24h board includes an item older than 12h; 1h ≠ 24h", async ({
    request,
  }) => {
    const h1 = await (
      await request.get(
        "/api/highlights?section=markets&window=1h&refresh=1",
      )
    ).json();
    const h24 = await (
      await request.get(
        "/api/highlights?section=markets&window=24h&refresh=1",
      )
    ).json();
    expect(h1.items.map((i: { text: string }) => i.text)).not.toEqual(
      h24.items.map((i: { text: string }) => i.text),
    );
    const now = Date.now();
    const older = h24.items.filter(
      (i: { publishedAt: string }) =>
        now - new Date(i.publishedAt).getTime() > 12 * 3600_000,
    );
    expect(older.length).toBeGreaterThanOrEqual(1);
  });

  test("NEW badges stay under half the tiles and ≤3", async ({ page }) => {
    const thirtyMinAgo = Date.now() - 30 * 60_000;
    await page.addInitScript(
      ([key, ts]) => {
        localStorage.setItem(key, String(ts));
      },
      [LAST_VISIT_KEY, thirtyMinAgo] as const,
    );
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 30_000,
    });
    const tiles = await page.locator('[data-tile="highlight"]').count();
    const news = await page.getByTestId("new-sticker").count();
    expect(news).toBeLessThanOrEqual(3);
    if (tiles > 0) {
      expect(news).toBeLessThanOrEqual(Math.floor(tiles / 2) || 3);
    }
  });

  test("desk chip stories stay on that desk within 2s", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({ timeout: 2_000 });
    const tiles = page.locator('[data-tile="highlight"]');
    await expect(tiles.first()).toBeVisible({ timeout: 2_000 });
    const n = await tiles.count();
    for (let i = 0; i < n; i++) {
      const sec = await tiles.nth(i).getAttribute("data-section");
      expect(sec === "markets" || sec === "").toBeTruthy();
    }
    await expect(
      page.locator('[data-tile="highlight"][data-section="india"]'),
    ).toHaveCount(0);
  });
});
