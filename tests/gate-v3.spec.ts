import { expect, test } from "@playwright/test";

test.describe("v3 Brief · Vibe · Radar", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "once");
  });

  test("Brief: tap tile → four lines; second tap cached; Escape closes", async ({
    page,
  }) => {
    await page.request.post("/api/brief", { data: { action: "reset" } });
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("verdict-hero")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("lens-window").click();
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });

    const tile = page.locator('[data-tile="highlight"]').first();
    await tile.click();
    await expect(page.getByTestId("brief-overlay")).toBeVisible();
    await expect(page.getByTestId("brief-lines")).toBeVisible();
    await expect(page.getByTestId("brief-what")).toBeVisible();
    await expect(page.getByTestId("brief-why")).toBeVisible();
    await expect(page.getByTestId("brief-who")).toBeVisible();
    await expect(page.getByTestId("brief-next")).toBeVisible();
    await expect(page.getByTestId("brief-source-link")).toHaveAttribute(
      "target",
      "_blank"
    );

    await page.getByTestId("brief-close").click();
    await expect(page.getByTestId("brief-overlay")).toHaveCount(0);

    await tile.click();
    await expect(page.getByTestId("brief-overlay")).toBeVisible();
    await expect(page.getByTestId("brief-cached")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("brief-overlay")).toHaveCount(0);
  });

  test("Brief RAW: llm fail → title + sources only", async ({ page }) => {
    await page.request.post("/api/brief", { data: { action: "reset" } });
    await page.goto("/?pwHotMarkets=1");
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("lens-window").click();
    await page.getByTestId("chip-markets").click();

    // Intercept brief with llmFail query
    await page.route("**/api/brief", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      url.searchParams.set("pwLlmFail", "1");
      const res = await page.request.post(url.toString(), {
        data: route.request().postDataJSON(),
      });
      await route.fulfill({
        status: res.status(),
        body: await res.text(),
        headers: res.headers(),
      });
    });

    await page.locator('[data-tile="highlight"]').first().click();
    await expect(page.getByTestId("brief-overlay")).toBeVisible();
    await expect(page.getByTestId("brief-raw")).toBeVisible();
    await expect(page.getByTestId("brief-lines")).toHaveCount(0);
  });

  test("Vibe: two columns Reddit + X", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("chip-vibe").click();
    await expect(page.getByTestId("vibe-panel")).toBeVisible();
    await expect(page.getByTestId("vibe-reddit")).toBeVisible();
    await expect(page.getByTestId("vibe-xpulse")).toBeVisible();
    await expect(
      page.locator('[data-testid="vibe-reddit"] a').first()
    ).toBeVisible();
  });

  test("Radar: clear by default; force trip → red verdict", async ({
    page,
    request,
  }) => {
    await request.post("/api/radar", { data: { action: "clear" } });
    await page.goto("/?pwQuiet=1");
    await expect(page.getByTestId("radar-strip")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("radar-strip")).toHaveAttribute(
      "data-clear",
      "1"
    );

    const tripped = await request.post("/api/radar", {
      data: { action: "trip", tripwireId: "rbi-press" },
    });
    expect(tripped.ok()).toBeTruthy();
    const body = await tripped.json();
    expect(body.clear).toBe(false);
    expect(body.verdictHint.level).toBe("red");

    await page.getByTestId("chip-radar").click();
    await expect(page.getByTestId("radar-panel")).toBeVisible();
    await expect(page.getByTestId("verdict-hero")).toContainText(/Radar/i);

    // Manifest present for PWA install hook
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", "/manifest.webmanifest");
  });
});
