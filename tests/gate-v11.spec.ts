import { expect, test } from "@playwright/test";
import { LAST_VISIT_KEY } from "../lib/last-visit";

test.describe("v1.1 NEW stickers + X Pulse", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop once");
  });

  test("NEW sticker: items newer than last visit show NEW; older do not", async ({
    page,
  }) => {
    // Pretend last visit was 30 minutes ago — 10m item is NEW, 50m is not
    const thirtyMinAgo = Date.now() - 30 * 60_000;
    await page.addInitScript(
      ([key, ts]) => {
        localStorage.setItem(key, String(ts));
      },
      [LAST_VISIT_KEY, thirtyMinAgo] as const
    );

    await page.goto("/");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("tab-markets").click();
    await page.getByTestId("pill-1h").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });

    const newStickers = page.getByTestId("new-sticker");
    await expect(newStickers.first()).toBeVisible({ timeout: 5_000 });

    // At least one tile with "ten minutes" should be NEW
    const tenMin = page
      .locator('[data-tile="highlight"]')
      .filter({ hasText: /ten minutes/i });
    await expect(tenMin.first()).toBeVisible();
    await expect(tenMin.first().getByTestId("new-sticker")).toBeVisible();

    // 50m item should NOT be NEW
    const fifty = page
      .locator('[data-tile="highlight"]')
      .filter({ hasText: /fifty minutes/i });
    if ((await fifty.count()) > 0) {
      await expect(fifty.first().getByTestId("new-sticker")).toHaveCount(0);
    }
  });

  test("NEW sticker: first visit (no last-visit) shows zero NEW stickers", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, LAST_VISIT_KEY);

    await page.goto("/");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("new-sticker")).toHaveCount(0);
  });

  test("X Pulse tab: fixture items + usage meter", async ({ page, request }) => {
    const api = await request.get(
      "/api/highlights?section=xpulse&window=4h"
    );
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    expect(json.section).toBe("xpulse");
    expect(json.items.length).toBeGreaterThan(0);
    expect(json.items[0].text).toMatch(/X Pulse/i);
    expect(json.xPulseUsage).toBeTruthy();
    expect(json.xPulseUsage.cap).toBeGreaterThan(0);

    // 1h should exclude the 700m overnight item
    const h1 = await (
      await request.get("/api/highlights?section=xpulse&window=1h")
    ).json();
    expect(
      h1.items.every(
        (i: { text: string }) => !/overnight/i.test(i.text)
      )
    ).toBeTruthy();

    await page.goto("/");
    await page.getByTestId("tab-xpulse").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-tile="highlight"]').first()
    ).toContainText(/X Pulse/i);
    await expect(page.getByTestId("xpulse-usage")).toBeVisible();
  });
});
