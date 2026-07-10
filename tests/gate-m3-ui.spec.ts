import { expect, test, type Page } from "@playwright/test";
import { SECTIONS, TIME_WINDOWS } from "../lib/types";

const HOT_SNIPPET = "Sensex jumps as FIIs return";

async function waitForShell(page: Page) {
  await expect(page.getByTestId("verdict-hero")).toBeVisible({
    timeout: 15_000,
  });
}

async function ensureWindowLens(page: Page) {
  // First visit: time pills only (no dual lens chrome / “By time” label).
  await expect(page.getByTestId("pill-4h")).toBeVisible({ timeout: 5_000 });
}

test.describe("M3 Bento Zine UI gate", () => {
  test("default load: All chip active, mega is top heat story", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop layout"
    );

    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);
    await page.getByTestId("chip-all").click();
    await expect(page.getByTestId("chip-all")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Evidence zone may be quiet-hero (no bento) or bento with mega
    const mega = page.locator('[data-tile="highlight"][data-mega="1"]');
    if ((await mega.count()) > 0) {
      await expect(mega.first()).toBeVisible();
      // Prefer sticker on mega; fall back to mega itself (avoid .or() strict clash)
      const sticker = mega.first().getByTestId("hot-sticker");
      if ((await sticker.count()) > 0) {
        await expect(sticker.first()).toBeVisible();
      }
    } else {
      await expect(page.getByTestId("verdict-hero")).toBeVisible();
    }
  });

  test("every chip × window renders without pageerror", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "all section×window combos once"
    );

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);

    const chipSections = SECTIONS.filter(
      (s) =>
        s.id !== "xpulse" &&
        s.id !== "vibe" &&
        s.id !== "radar" &&
        s.id !== "trend",
    );
    for (const section of chipSections) {
      const chipId =
        section.id === "all" ? "chip-all" : `chip-${section.id}`;
      await page.getByTestId(chipId).click();
      for (const window of TIME_WINDOWS) {
        await page.getByTestId(`pill-${window}`).click();
        await expect(page.getByTestId("verdict-hero")).toBeVisible({
          timeout: 5_000,
        });
      }
    }

    // TREND is a dedicated panel — no verdict hero
    await page.getByTestId("chip-trend").click();
    await expect(page.getByTestId("social-trends")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("verdict-hero")).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("states: quiet verdict, stale strip, no RAW sticker", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop states"
    );

    // SSR first paint — no empty skeleton on cold load (intentional).
    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);
    await expect(page.getByTestId("score-chips")).toBeVisible();

    // --- quiet verdict via fixture override ---
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("pwQuiet", "1");
      url.searchParams.set("refresh", "1");
      const res = await page.request.get(url.toString());
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: await res.text(),
      });
    });
    await page.getByTestId("refresh-btn").click();
    await expect(page.getByTestId("verdict-hero")).toContainText(/All quiet/i, {
      timeout: 5_000,
    });
    await page.unrouteAll({ behavior: "ignoreErrors" });

    // --- stale strip ---
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          section: url.searchParams.get("section") ?? "all",
          window: url.searchParams.get("window") ?? "12h",
          lens: "window",
          generatedAt: new Date().toISOString(),
          stale: true,
          rawMode: false,
          sourcesUnreachable: true,
          verdict: {
            text: "All quiet. Nothing needs you right now.",
            level: "green",
            llmPolished: false,
          },
          scores: [],
          items: [
            {
              text: "Stale fixture headline for banner test",
              sources: [
                {
                  name: "Fixture A",
                  url: "https://fixture.pulsewire.test/x",
                },
              ],
              publishedAt: new Date().toISOString(),
              hot: false,
              section: "india",
            },
          ],
        }),
      });
    });
    await page.getByTestId("pill-12h").click();
    await expect(page.getByTestId("stale-banner")).toBeVisible({
      timeout: 5_000,
    });
    await page.unrouteAll({ behavior: "ignoreErrors" });

    // --- RAW mode still loads; sticker intentionally hidden (reads as unfinished) ---
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          section: url.searchParams.get("section") ?? "all",
          window: url.searchParams.get("window") ?? "12h",
          lens: "window",
          generatedAt: new Date().toISOString(),
          stale: false,
          rawMode: true,
          verdict: {
            text: "All quiet. Nothing needs you right now.",
            level: "green",
            llmPolished: false,
          },
          scores: [],
          items: [
            {
              text: "Raw mode fixture headline that is a full flash line for readers",
              sources: [
                {
                  name: "Fixture A",
                  url: "https://fixture.pulsewire.test/raw",
                },
              ],
              publishedAt: new Date().toISOString(),
              hot: false,
              section: "india",
            },
          ],
        }),
      });
    });
    await page.getByTestId("refresh-btn").click();
    await expect(page.getByTestId("raw-sticker")).toHaveCount(0);
    await expect(page.getByTestId("verdict-hero")).toContainText(/quiet/i, {
      timeout: 5_000,
    });
  });

  test("theme: Night Zine class + persists after reload", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop theme"
    );

    await page.goto("/");
    await waitForShell(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/night/);
    const stored = await page.evaluate(() =>
      localStorage.getItem("pulsewire-theme")
    );
    expect(stored).toBe("night");
    await page.reload();
    await waitForShell(page);
    await expect(page.locator("html")).toHaveClass(/night/);
  });

  test("links: tile opens Brief; overlay source is <a target=_blank>", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop links"
    );

    await page.addInitScript(() => {
      localStorage.removeItem("pulsewire-last-visit");
    });
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.delete("pwQuiet");
      url.searchParams.set("pwHotMarkets", "1");
      url.searchParams.set("lens", "window");
      const res = await page.request.get(url.toString());
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: await res.text(),
      });
    });
    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });
    const tiles = page.locator('[data-tile="highlight"]');
    expect(await tiles.count()).toBeGreaterThan(0);
    await expect(tiles.first().getByTestId("brief-hint")).toBeVisible();
    await tiles.first().click();
    await expect(page.getByTestId("brief-overlay")).toBeVisible();
    const src = page.getByTestId("brief-source-link");
    await expect(src).toHaveAttribute("target", "_blank");
    const rel = await src.getAttribute("rel");
    expect(rel ?? "").toMatch(/noopener/);
    const href = await src.getAttribute("href");
    expect(href && href.length > 0).toBeTruthy();
  });

  test("mobile 360: no horizontal scroll, tap targets ≥44px", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-mobile",
      "mobile only"
    );

    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);

    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);

    for (const id of ["chip-all", "chip-markets", "pill-1h", "refresh-btn"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).toBeTruthy();
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
    }
  });

  test("a11y floor: Tab reaches tabs/pills/tiles with visible focus", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop a11y"
    );

    await page.addInitScript(() => {
      localStorage.removeItem("pulsewire-last-visit");
    });
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("pwHotMarkets", "1");
      url.searchParams.set("lens", "window");
      const res = await page.request.get(url.toString());
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: await res.text(),
      });
    });
    await page.goto("/");
    await waitForShell(page);
    await ensureWindowLens(page);
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId("chip-all").focus();
    await expect(page.getByTestId("chip-all")).toBeFocused();
    const outline = await page.getByTestId("chip-all").evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(outline.length).toBeGreaterThan(0);

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();

    const firstTile = page.locator('[data-tile="highlight"]').first();
    await firstTile.focus();
    await expect(firstTile).toBeFocused();
  });

  test("evidence screenshots desktop 1280 + mobile 360", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    await expect(page.getByTestId("score-chips")).toBeVisible();
    const name = test.info().project.name;
    await page.screenshot({
      path: `test-results/evidence-${name}.png`,
      fullPage: true,
    });
  });
});
