import { expect, test } from "@playwright/test";

test.describe("usage beacon", () => {
  test("open ping + pagehide session beacon", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop once",
    );

    const opens: string[] = [];
    const sessions: string[] = [];

    await page.route("**/api/usage", async (route) => {
      const post = route.request().postData() || "";
      if (post.includes('"open"')) opens.push(post);
      if (post.includes('"session"')) sessions.push(post);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.addInitScript(() => {
      localStorage.removeItem("pw_device");
      sessionStorage.clear();
    });

    await page.goto("/?pwQuiet=1");
    await expect(page.getByTestId("verdict-hero")).toBeVisible({
      timeout: 15_000,
    });

    await expect.poll(() => opens.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(opens[0]).toMatch(/deviceId/);

    // Trigger pagehide via navigation away
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    await expect
      .poll(() => sessions.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(sessions[0]).toMatch(/sessionMs/);

    const health = await (await page.request.get("/api/health")).json();
    expect(health.usage).toBeTruthy();
    expect(typeof health.usage.devicesToday).toBe("number");
    expect(health.history?.path).toBeTruthy();
    expect(String(health.history.path)).not.toMatch(/\//);
  });

  test("onboarding shows once then stays dismissed", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "desktop once",
    );
    await page.goto("/?pwQuiet=1");
    await page.evaluate(() => {
      localStorage.removeItem("pw_onboard_dismissed");
      localStorage.removeItem("pw_calibrating_explained");
    });
    await page.reload();
    await expect(page.getByTestId("onboarding-line")).toBeVisible({
      timeout: 15_000,
    });
    // No stacked Got its — calibrating waits for onboard dismiss
    await expect(page.getByTestId("calibrating-explainer")).toHaveCount(0);
    await page.getByTestId("onboarding-dismiss").click();
    await expect(page.getByTestId("onboarding-line")).toHaveCount(0);
    await expect(page.getByTestId("calibrating-explainer")).toBeVisible({
      timeout: 5_000,
    });
    await page.reload();
    await expect(page.getByTestId("verdict-hero")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("onboarding-line")).toHaveCount(0);
  });
});
