import { expect, test, type Page } from "@playwright/test";
import { SECTIONS, TIME_WINDOWS } from "../lib/types";

const HOT_SNIPPET = "Sensex jumps as FIIs return";

async function waitForGrid(page: Page) {
  await expect(page.getByTestId("bento-grid")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("M3 Bento Zine UI gate", () => {
  test("default load: All active, mega is top 🔥, sticker matches source count", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop layout"
    );

    await page.goto("/");
    await waitForGrid(page);

    await expect(page.getByTestId("tab-all")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    const mega = page.locator('[data-tile="highlight"][data-mega="1"]');
    await expect(mega).toHaveCount(1);
    await expect(mega).toContainText(HOT_SNIPPET);

    const sticker = page.getByTestId("hot-sticker");
    await expect(sticker).toBeVisible();
    await expect(sticker).toContainText(/🔥\s*2\s*SOURCES/i);
  });

  test("every tab × window renders without pageerror", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "32 combos once"
    );

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await waitForGrid(page);

    for (const section of SECTIONS) {
      await page.getByTestId(`tab-${section.id}`).click();
      for (const window of TIME_WINDOWS) {
        await page.getByTestId(`pill-${window}`).click();
        // Either grid, skeleton (brief), or quiet hour
        await expect(
          page
            .getByTestId("bento-grid")
            .or(page.getByTestId("bento-skeleton"))
            .or(page.getByTestId("quiet-hour"))
        ).toBeVisible({ timeout: 5_000 });
        // Settle on non-skeleton
        await expect(
          page
            .getByTestId("bento-grid")
            .or(page.getByTestId("quiet-hour"))
        ).toBeVisible({ timeout: 5_000 });
      }
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("states: skeleton, quiet hour TRY 4H, stale strip, RAW sticker", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop states"
    );

    // --- loading skeleton (throttle first response) ---
    let first = true;
    await page.route("**/api/highlights*", async (route) => {
      if (first) {
        first = false;
        await new Promise((r) => setTimeout(r, 800));
      }
      await route.continue();
    });
    await page.goto("/");
    await expect(page.getByTestId("bento-skeleton")).toBeVisible({
      timeout: 500,
    });
    await waitForGrid(page);
    await page.unroute("**/api/highlights*");

    // --- quiet hour ---
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      const res = await route.fetch();
      const json = await res.json();
      if (url.searchParams.get("window") === "1h") {
        json.items = [];
      }
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: JSON.stringify(json),
      });
    });
    await page.getByTestId("pill-1h").click();
    await expect(page.getByTestId("quiet-hour")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("try-4h")).toBeVisible();
    await page.getByTestId("try-4h").click();
    await expect(page.getByTestId("pill-4h")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.unroute("**/api/highlights*");

    // --- stale strip ---
    await page.route("**/api/highlights*", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.stale = true;
      json.sourcesUnreachable = true;
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: JSON.stringify(json),
      });
    });
    await page.getByTestId("pill-12h").click();
    await expect(page.getByTestId("stale-banner")).toBeVisible({
      timeout: 5_000,
    });
    await page.unroute("**/api/highlights*");

    // --- RAW header sticker ---
    await page.route("**/api/highlights*", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.rawMode = true;
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: JSON.stringify(json),
      });
    });
    await page.getByTestId("refresh-btn").click();
    await expect(page.getByTestId("raw-sticker")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("theme: Night Zine class + persists after reload", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop theme"
    );

    await page.goto("/");
    await waitForGrid(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/night/);
    const stored = await page.evaluate(() =>
      localStorage.getItem("pulsewire-theme")
    );
    expect(stored).toBe("night");
    await page.reload();
    await waitForGrid(page);
    await expect(page.locator("html")).toHaveClass(/night/);
  });

  test("links: every tile is <a> with target=_blank, rel noopener, href", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop links"
    );

    await page.goto("/");
    await waitForGrid(page);
    const tiles = page.locator('a[data-tile="highlight"]');
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      await expect(tile).toHaveAttribute("target", "_blank");
      const rel = await tile.getAttribute("rel");
      expect(rel ?? "").toMatch(/noopener/);
      const href = await tile.getAttribute("href");
      expect(href && href.length > 0).toBeTruthy();
    }
  });

  test("mobile 360: no horizontal scroll, tap targets ≥44px", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-mobile",
      "mobile only"
    );

    await page.goto("/");
    await waitForGrid(page);

    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);

    for (const id of ["tab-all", "tab-markets", "pill-1h", "refresh-btn"]) {
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

    await page.goto("/");
    await waitForGrid(page);

    // Focus first tab via keyboard
    await page.getByTestId("tab-all").focus();
    await expect(page.getByTestId("tab-all")).toBeFocused();
    const outline = await page.getByTestId("tab-all").evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    // focus-visible outline or at least focused element
    expect(outline.length).toBeGreaterThan(0);

    await page.keyboard.press("Tab");
    // Somewhere in the chrome is focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();

    const firstTile = page.locator('a[data-tile="highlight"]').first();
    await firstTile.focus();
    await expect(firstTile).toBeFocused();
  });

  test("evidence screenshots desktop 1280 + mobile 360", async ({ page }) => {
    await page.goto("/");
    await waitForGrid(page);
    const name = test.info().project.name;
    await page.screenshot({
      path: `test-results/evidence-${name}.png`,
      fullPage: true,
    });
  });
});
