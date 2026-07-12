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
    // Clean news desk — social never mixes INTO the feed. The Morning Feed
    // desktop layout adds a separate TREND aside column; that is allowed,
    // but the feed itself must stay social-free and the aside stays outside.
    await expect(page.getByTestId("trend-strip")).toHaveCount(0);
    await expect(
      page.locator('[data-testid="bento-grid"] [data-testid="social-trends"]'),
    ).toHaveCount(0);
    const asideTrends = page.locator(
      'aside [data-testid="social-trends"], [data-testid="social-trends"]',
    );
    expect(await asideTrends.count()).toBeLessThanOrEqual(1);
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

  test("collapsed X never says quiet when needs_key", async ({ page }) => {
    await page.route("**/api/highlights**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("section") !== "trend") {
        await route.continue();
        return;
      }
      const res = await route.fetch();
      const json = await res.json();
      json.socialTrends = {
        reddit: {
          status: "ok",
          items: [
            {
              title: "Fixture Reddit thread about markets",
              url: "https://reddit.com/r/india/1",
              source: "r/india",
              publishedAt: new Date().toISOString(),
              plane: "reddit",
            },
          ],
          note: null,
        },
        x: {
          status: "needs_key",
          items: [],
          note: "X plane off — no API key configured",
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(json),
      });
    });
    await page.goto("/?pwHotMarkets=1");
    await page.getByTestId("chip-trend").click();
    const x = page.getByTestId("social-trends-x");
    await expect(x).toBeVisible({ timeout: 30_000 });
    await expect(x).toHaveAttribute("data-status", "needs_key");
    await expect(x).toContainText(/not configured|Reddit only/i);
    await expect(x).not.toContainText(/quiet/i);
  });

  test("TREND items render as tiles with velocity accent", async ({ page }) => {
    await page.goto("/?pwHotMarkets=1");
    await page.getByTestId("chip-trend").click();
    await expect(page.getByTestId("social-trends")).toBeVisible({
      timeout: 30_000,
    });
    const tiles = page.getByTestId("trend-tile");
    await expect(tiles.first()).toBeVisible();
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
    // Accents are earned — data-accent is hot|warm|none
    for (let i = 0; i < count; i++) {
      const accent = await tiles.nth(i).getAttribute("data-accent");
      expect(["hot", "warm", "none"]).toContain(accent);
    }
  });

  test("NEW stickers are capped at 3 per board", async ({ page }) => {
    const thirtyMinAgo = Date.now() - 30 * 60_000;
    await page.addInitScript(
      ([key, ts]) => {
        localStorage.setItem(key, String(ts));
      },
      ["pulsewire-last-visit", thirtyMinAgo] as const,
    );
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 30_000,
    });
    const news = page.getByTestId("new-sticker");
    const n = await news.count();
    expect(n).toBeLessThanOrEqual(3);
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
    // Desk board must never be a horizontal scroller, whatever its layout
    // (rows, rings, chips). Assert the intent: content fits the container.
    const widths = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="score-chips"]');
      if (!board) return null;
      return {
        board: board.scrollWidth,
        client: board.clientWidth,
      };
    });
    expect(widths).toBeTruthy();
    expect(widths!.board).toBeLessThanOrEqual(widths!.client + 1);
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
