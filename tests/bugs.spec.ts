import { expect, test, type APIRequestContext } from "@playwright/test";

const HOT_TITLE =
  "RBI holds rates as inflation cools; banks lead market rebound";

async function api(
  request: APIRequestContext,
  section: string,
  window: string,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams({ section, window, ...extra });
  const res = await request.get(`/api/highlights?${params}`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return { res, json };
}

test.describe("BUG regressions", () => {
  test("tab switch: skeleton ≤150ms, Markets tile ≤1.5s, no prior-section tiles", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop timing gate"
    );

    await page.goto("/");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 15_000,
    });

    // Visit India first so we have prior-section tiles in memory
    await page.getByTestId("tab-india").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[data-tile="highlight"]').first()).toContainText(
      /India/i,
      { timeout: 5_000 }
    );

    const indiaTiles = page.locator(
      '[data-tile="highlight"][data-section="india"]'
    );
    await expect(indiaTiles.first()).toBeVisible();

    const clickAt = Date.now();
    await page.getByTestId("tab-markets").click();

    // Skeleton must appear almost immediately
    await expect(page.getByTestId("bento-skeleton")).toBeVisible({
      timeout: 150,
    });
    const skeletonMs = Date.now() - clickAt;
    expect(skeletonMs).toBeLessThanOrEqual(150);

    // No India tiles after the click (skeleton or Markets only)
    await expect(
      page.locator('[data-tile="highlight"][data-section="india"]')
    ).toHaveCount(0);

    // Markets fixture headline within warm-cache budget
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 1_500,
    });
    await expect(
      page.locator('[data-tile="highlight"][data-section="markets"]').first()
    ).toContainText(/Markets/i, { timeout: 1_500 });

    // Still zero India tiles
    await expect(
      page.locator('[data-tile="highlight"][data-section="india"]')
    ).toHaveCount(0);
  });

  test("windows differ: 1h ≠ 24h; 1h only ≤1h; 24h includes 20h item", async ({
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "API once"
    );

    const { json: h1 } = await api(request, "markets", "1h");
    const { json: h24 } = await api(request, "markets", "24h");

    const texts1 = h1.items.map((i: { text: string }) => i.text);
    const texts24 = h24.items.map((i: { text: string }) => i.text);
    expect(texts1).not.toEqual(texts24);

    const now = Date.now();
    for (const item of h1.items) {
      const age = now - new Date(item.publishedAt).getTime();
      expect(age).toBeLessThanOrEqual(60 * 60 * 1000 + 5_000);
      expect(item.text).toMatch(/ten minutes|fifty minutes|minor wire/i);
      expect(item.text).not.toMatch(/twenty hours|three hours|RBI holds/i);
    }

    expect(
      texts24.some((t: string) => /twenty hours/i.test(t))
    ).toBeTruthy();
  });

  test("9h hot merged story surfaces in 12h and 24h with 🔥", async ({
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "API once"
    );

    for (const window of ["12h", "24h"] as const) {
      const { json } = await api(request, "markets", window);
      const hot = json.items.find(
        (i: { text: string; hot: boolean }) =>
          i.text.includes("RBI holds rates") && i.hot
      );
      expect(hot, `missing 🔥 in ${window}`).toBeTruthy();
      expect(hot.sources.length).toBeGreaterThanOrEqual(2);
    }

    // 1h must NOT include the 9h story
    const { json: h1 } = await api(request, "markets", "1h");
    expect(
      h1.items.some((i: { text: string }) => i.text.includes("RBI holds"))
    ).toBeFalsy();
  });

  test("?refresh=1 forces cache miss", async ({ request }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "API once"
    );

    // Warm
    await api(request, "markets", "4h");
    const hit = await api(request, "markets", "4h");
    expect(hit.json.cacheMiss).toBeFalsy();
    expect(hit.res.headers()["x-pulsewire-cache"]).toBe("HIT");

    const miss = await api(request, "markets", "4h", { refresh: "1" });
    expect(miss.json.cacheMiss).toBeTruthy();
    expect(miss.res.headers()["x-pulsewire-cache"]).toBe("MISS");
  });
});
