import { expect, test, type Page } from "@playwright/test";
import fs from "fs";

/**
 * M5 gate: history writer + baseline deviation.
 * webServer runs with PW_HISTORY=1 + isolated PULSEWIRE_DB_PATH.
 * Seed / math asserts go through PW_TEST-only /api/history-stats.
 */

async function requestReset(page: Page) {
  await page.request.post("/api/history-stats", { data: { action: "reset" } });
}

test.describe("M5 baselines & history", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "once");
  });

  test("history writer persists samples and survives reopen", async ({
    request,
  }) => {
    // Force a refresh so scores run (and writer runs when PW_HISTORY=1)
    const a = await request.get(
      "/api/highlights?section=all&window=4h&lens=window&refresh=1&pwQuiet=1"
    );
    expect(a.ok()).toBeTruthy();

    const stats1 = await request.get("/api/history-stats");
    expect(stats1.ok()).toBeTruthy();
    const s1 = await stats1.json();
    expect(s1.enabled).toBeTruthy();
    expect(s1.count).toBeGreaterThan(0);
    const pathBefore = s1.path as string;
    expect(pathBefore).toBeTruthy();

    // Second cycle adds more rows
    await request.get(
      "/api/highlights?section=markets&window=4h&lens=window&refresh=1&pwQuiet=1"
    );
    const stats2 = await (await request.get("/api/history-stats")).json();
    expect(stats2.count).toBeGreaterThanOrEqual(s1.count);
    expect(stats2.path).toBe(pathBefore);
    // Isolated e2e DB path (not the live data/pulsewire.db)
    expect(String(pathBefore)).toMatch(/e2e-pulsewire/);

    // Close + reopen connection — rows must survive (restart moat clock)
    const reopen = await request.post("/api/history-stats", {
      data: { action: "reopen" },
    });
    expect(reopen.ok()).toBeTruthy();
    const re = await reopen.json();
    expect(re.countAfter).toBe(re.countBefore);
    expect(re.countAfter).toBeGreaterThan(0);
  });

  test("seeded bucket → deviation blend; cold bucket → calibrating", async ({
    request,
  }) => {
    // Seed 14+ samples for markets current IST bucket via test endpoint
    const seed = await request.post("/api/history-stats", {
      data: { action: "seed-calibrated-markets" },
    });
    expect(seed.ok()).toBeTruthy();
    const seeded = await seed.json();
    expect(seeded.seeded).toBeGreaterThanOrEqual(14);

    const hot = await request.get(
      "/api/highlights?section=all&window=4h&lens=window&pwHotMarkets=1&refresh=1"
    );
    expect(hot.ok()).toBeTruthy();
    const json = await hot.json();
    const mkt = json.scores.find(
      (s: { section: string }) => s.section === "markets"
    );
    expect(mkt).toBeTruthy();
    // With enough history, calibrating should be false for markets
    expect(mkt.calibrating).toBe(false);
    expect(mkt.score).toBeGreaterThanOrEqual(0);
    expect(mkt.score).toBeLessThanOrEqual(100);

    // tech was wiped by seed reset — only markets seeded → calibrating
    const tech = json.scores.find(
      (s: { section: string }) => s.section === "tech"
    );
    expect(tech.calibrating).toBe(true);
  });

  test("cold start shows calibrating mark on chips", async ({ page }) => {
    await requestReset(page);
    await page.goto("/?pwQuiet=1");
    await expect(page.getByTestId("score-chips")).toBeVisible();
    // After reset, buckets are empty → muted calibrating (no cryptic ~)
    await expect(page.getByTestId("calibrating-markets")).toBeAttached();
    await expect(page.locator('[data-testid="chip-markets"]')).toHaveAttribute(
      "data-calibrating",
      "1",
    );
    await expect(page.getByTestId("calibrating-explainer")).toBeVisible();
  });

  test("baseline math: median/MAD/sigmoid unit via stats endpoint", async ({
    request,
  }) => {
    const res = await request.post("/api/history-stats", {
      data: { action: "assert-baseline-math" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.median).toBe(10);
    expect(body.mad).toBe(2);
  });
});
