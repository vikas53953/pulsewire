import { expect, test, type APIRequestContext } from "@playwright/test";

async function api(
  request: APIRequestContext,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams({
    section: "all",
    window: "4h",
    lens: "window",
    ...extra,
  });
  const res = await request.get(`/api/highlights?${params}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe("M4 Verdict Engine", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop once");
  });

  test("quiet celebrates desks; hot Markets includes why-it-matters", async ({
    request,
  }) => {
    const quiet = await api(request, { pwQuiet: "1", refresh: "1" });
    expect(quiet.verdict.level).toBe("green");
    expect(quiet.verdict.text).toMatch(/All quiet across every desk/i);
    expect(quiet.verdict.text).toMatch(/Nothing needs you right now/i);
    expect(quiet.verdict.blind).toBeFalsy();

    const hot = await api(request, { pwHotMarkets: "1", refresh: "1" });
    expect(hot.verdict.level).toBe("red");
    expect(hot.verdict.text).toMatch(/Markets hot/i);
    expect(hot.verdict.text).toMatch(/\d+ sources/i);
    expect(hot.verdict.why).toMatch(/Watch:/i);
    expect(hot.verdict.why).not.toMatch(/pulse \d+/i);
    expect(hot.verdict.text).not.toMatch(/credible/i);
  });

  test("feeds down → blind ≠ quiet", async ({ request, page }) => {
    const json = await api(request, { pwFeedsDown: "1", refresh: "1" });
    expect(json.sourcesUnreachable).toBeTruthy();
    expect(json.verdict.blind).toBeTruthy();
    expect(json.verdict.text).toMatch(/Sources unreachable|status unknown/i);
    expect(json.verdict.text).not.toMatch(/Nothing needs you right now/i);
    expect(json.scores.every((s: { unknown?: boolean }) => s.unknown)).toBe(
      true,
    );

    await page.goto("/?pwFeedsDown=1");
    await expect(page.getByTestId("verdict-hero")).toHaveAttribute(
      "data-blind",
      "1",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("blind-banner")).toBeVisible();
    await expect(page.getByTestId("chip-markets")).toHaveAttribute(
      "data-unknown",
      "1",
    );
    await expect(page.getByTestId("quiet-hour")).toHaveCount(0);
    await expect(page.getByTestId("blind-empty")).toBeVisible();
  });

  test("quiet fixture → green All quiet verdict + chips", async ({
    request,
    page,
  }) => {
    const json = await api(request, { pwQuiet: "1", refresh: "1" });
    expect(json.verdict.level).toBe("green");
    expect(json.verdict.text).toMatch(/All quiet/i);
    expect(json.verdict.llmPolished).toBe(false);
    expect(json.scores.length).toBe(7);
    expect(json.scores.every((s: { level: string }) => s.level === "green")).toBe(
      true
    );

    await page.addInitScript(() => {
      localStorage.removeItem("pulsewire-last-visit");
    });
    await page.route("**/api/highlights*", async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("pwQuiet", "1");
      url.searchParams.set("refresh", "1");
      url.searchParams.set("lens", "window");
      const res = await page.request.get(url.toString());
      await route.fulfill({
        status: res.status(),
        headers: res.headers(),
        body: await res.text(),
      });
    });
    await page.goto("/");
    await expect(page.getByTestId("verdict-hero")).toContainText(/All quiet/i, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("quiet-win")).toBeVisible();
    await expect(page.getByTestId("score-chips")).toBeVisible();
    await expect(page.getByTestId("chip-markets")).toBeVisible();
    await page.getByTestId("chip-markets").hover();
    await expect(page.getByTestId("pulse-why")).toBeVisible();
    await expect(page.getByTestId("pulse-why")).toContainText(
      /quiet|warming|hot|calibrating|driven by|unknown/i,
    );
  });

  test("hot Markets fixture → red verdict naming Markets + counts", async ({
    request,
  }) => {
    const json = await api(request, { pwHotMarkets: "1", refresh: "1" });
    expect(json.verdict.level).toBe("red");
    expect(json.verdict.text).toMatch(/Markets hot/i);
    expect(json.verdict.text).toMatch(/\d+ sources/i);
    const mkt = json.scores.find(
      (s: { section: string }) => s.section === "markets"
    );
    expect(mkt.level).toBe("red");
    expect(mkt.score).toBeGreaterThanOrEqual(70);
  });

  test("4h age-diversity + heat floor; RAW verdict is template", async ({
    request,
  }) => {
    const json = await api(request, {
      pwHotMarkets: "1",
      refresh: "1",
      section: "markets",
      window: "4h",
      pwLlmFail: "1",
    });
    expect(json.rawMode).toBe(true);
    expect(json.verdict.llmPolished).toBe(false);
    expect(json.items.length).toBeGreaterThanOrEqual(2);
    // Cap raised then tightened for scanability (ALL ≤8, desk ≤10).
    expect(json.items.length).toBeLessThanOrEqual(10);

    const topHeat = Math.max(
      ...json.items.map((i: { heat: number }) => i.heat ?? 0)
    );
    const strong = json.items.filter(
      (i: { heat: number }) => (i.heat ?? 0) >= topHeat * 0.15 - 0.01
    );
    // Most items above floor; at most 1–2 diversity exceptions allowed
    expect(strong.length).toBeGreaterThanOrEqual(Math.min(2, json.items.length));
    expect(json.items.length - strong.length).toBeLessThanOrEqual(2);
    for (const item of json.items) {
      expect(item.text.length).toBeLessThanOrEqual(160);
    }

    // Age span: at least one item older than 1h when 4h window has diversity
    const now = Date.now();
    const ages = json.items.map(
      (i: { publishedAt: string }) => now - new Date(i.publishedAt).getTime()
    );
    const hasOlder = ages.some((a: number) => a > 60 * 60 * 1000);
    const hasFresh = ages.some((a: number) => a <= 60 * 60 * 1000);
    expect(hasFresh).toBeTruthy();
    expect(hasOlder).toBeTruthy();
  });

  test("since lens returns only post-since clusters", async ({ request }) => {
    const since = new Date(Date.now() - 60 * 60_000).toISOString(); // 1h ago
    const json = await api(request, {
      lens: "since",
      since,
      refresh: "1",
      section: "markets",
    });
    expect(json.lens).toBe("since");
    for (const item of json.items) {
      const first = new Date(item.firstSeen || item.publishedAt).getTime();
      const anyNewSource = item.sources.some(
        (s: { firstSeen?: string }) =>
          new Date(s.firstSeen || item.publishedAt).getTime() >
          new Date(since).getTime()
      );
      expect(first > new Date(since).getTime() || anyNewSource).toBeTruthy();
    }
  });

  test("chips navigate; tabs retired", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("pulsewire-last-visit");
    });
    await page.goto("/");
    await expect(page.getByTestId("verdict-hero")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("score-chips")).toBeVisible();
    await expect(page.getByTestId("tab-india")).toHaveCount(0);
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("chip-markets")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("verdict-hero")).toBeVisible();
  });
});
