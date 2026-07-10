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
      "_blank",
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

  test("Vibe: two columns On X / On Reddit with fixture data", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("chip-vibe").click();
    await expect(page.getByTestId("vibe-panel")).toBeVisible();
    await expect(page.getByTestId("vibe-reddit")).toBeVisible();
    await expect(page.getByTestId("vibe-xpulse")).toBeVisible();
    await expect(page.getByTestId("vibe-reddit")).toContainText(/On Reddit/i);
    await expect(page.getByTestId("vibe-xpulse")).toContainText(/On X/i);
    await expect(
      page.locator('[data-testid="vibe-reddit"] a').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="vibe-xpulse"] a').first(),
    ).toBeVisible();
    await expect(page.getByTestId("vibe-reddit")).toHaveAttribute(
      "data-status",
      "ok",
    );
    await expect(page.getByTestId("vibe-xpulse")).toHaveAttribute(
      "data-status",
      "ok",
    );
    await expect(page.getByTestId("chip-radar")).toHaveText(/RADAR/i);
  });

  test("BUG-V1: honest empty states — failed ≠ quiet ≠ needs_key", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });

    // Chip click must trigger /api/vibe (not a dead trigger).
    const vibeReq = page.waitForRequest(
      (r) => r.url().includes("/api/vibe") && r.method() === "GET",
    );
    await page.getByTestId("chip-vibe").click();
    const req = await vibeReq;
    expect(req.url()).toMatch(/refresh=1/);

    await expect(page.getByTestId("vibe-panel")).toBeVisible();
    await expect(page.getByTestId("vibe-reddit")).toHaveAttribute(
      "data-status",
      "ok",
    );

    // Forced feeds-down → Reddit failed (not quiet).
    await page.route("**/api/vibe**", async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("pwFeedsDown", "1");
      url.searchParams.set("refresh", "1");
      const res = await page.request.fetch(url.toString());
      await route.fulfill({
        status: res.status(),
        body: await res.text(),
        headers: res.headers(),
      });
    });
    await page.getByTestId("refresh-btn").click();
    await expect(page.getByTestId("vibe-reddit")).toHaveAttribute(
      "data-status",
      "failed",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("vibe-reddit-state-failed")).toBeVisible();
    await expect(page.getByTestId("vibe-reddit-state-quiet")).toHaveCount(0);
  });

  test("Radar: clear by default; force trip → red verdict with headline", async ({
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
      "1",
    );

    const tripped = await request.post("/api/radar", {
      data: { action: "trip", tripwireId: "sebi-press" },
    });
    expect(tripped.ok()).toBeTruthy();
    const body = await tripped.json();
    expect(body.clear).toBe(false);
    expect(body.verdictHint.level).toBe("red");
    expect(body.verdictHint.text).toMatch(/fixture headline/i);
    expect(body.verdictHint.text).not.toMatch(/changed$/i);

    await page.getByTestId("chip-radar").click();
    await expect(page.getByTestId("radar-panel")).toBeVisible();
    await expect(page.getByTestId("verdict-hero")).toContainText(/Radar/i);
    await expect(page.getByTestId("verdict-hero")).toContainText(
      /fixture headline/i,
    );
    await expect(page.getByTestId("radar-panel")).toContainText(/tripwire/i);
    // BUG-V3: Updated timestamp must not be blank on Radar
    await expect(page.getByTestId("status-updated")).not.toHaveText(
      /updated —\s*$/i,
    );

    await expect(page.locator('link[rel="manifest"]').first()).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
  });

  test("BUG-V2: same items + noise → no trip; new item → trip with title", async ({
    request,
  }) => {
    const baseline = [
      {
        id: "https://rbi.org.in/press/a",
        title: "RBI keeps repo rate unchanged",
        link: "https://rbi.org.in/press/a",
      },
      {
        id: "https://rbi.org.in/press/b",
        title: "Liquidity adjustment facility schedule",
        link: "https://rbi.org.in/press/b",
      },
    ];
    // Same listing ids; "page" would have a new timestamp — must NOT trip.
    const sameItemsNoise = [
      { ...baseline[0] },
      { ...baseline[1] },
      // untitled noise row that would appear if we hashed HTML — ignored if no new id
    ];
    const noTrip = await request.post("/api/radar", {
      data: {
        action: "diff-fixture",
        sourceName: "RBI press",
        previous: baseline,
        current: sameItemsNoise,
      },
    });
    expect(noTrip.ok()).toBeTruthy();
    const quiet = await noTrip.json();
    expect(quiet.trips).toEqual([]);
    expect(quiet.verdict).toBeNull();

    // Content-free "changed" title must never become a trip/verdict.
    const garbage = await request.post("/api/radar", {
      data: {
        action: "diff-fixture",
        sourceName: "RBI press",
        previous: baseline,
        current: [
          ...baseline,
          {
            id: "https://rbi.org.in/press/noise",
            title: "RBI press changed",
            link: "https://rbi.org.in/press/noise",
          },
        ],
      },
    });
    const g = await garbage.json();
    expect(g.trips).toEqual([]);
    expect(g.verdict).toBeNull();

    // Untitled new id → no trip.
    const untitled = await request.post("/api/radar", {
      data: {
        action: "diff-fixture",
        sourceName: "RBI press",
        previous: baseline,
        current: [
          ...baseline,
          {
            id: "https://rbi.org.in/press/c",
            title: "",
            link: "https://rbi.org.in/press/c",
          },
        ],
      },
    });
    const u = await untitled.json();
    expect(u.trips).toEqual([]);
    expect(u.verdict).toBeNull();

    // One real new item → trip carrying that headline.
    const withNew = await request.post("/api/radar", {
      data: {
        action: "diff-fixture",
        sourceName: "RBI press",
        previous: baseline,
        current: [
          {
            id: "https://rbi.org.in/press/new",
            title: "RBI announces special market operations for July",
            link: "https://rbi.org.in/press/new",
          },
          ...baseline,
        ],
      },
    });
    const tripped = await withNew.json();
    expect(tripped.trips).toHaveLength(1);
    expect(tripped.trips[0].title).toMatch(/special market operations/i);
    expect(tripped.verdict.level).toBe("red");
    expect(tripped.verdict.text).toMatch(
      /🔴 Radar: RBI press — RBI announces special market operations/i,
    );
  });

  test("BUG-V3: malformed radar trip must not touch verdict", async ({
    request,
  }) => {
    const res = await request.post("/api/radar", {
      data: {
        action: "diff-fixture",
        sourceName: "RBI press",
        previous: [{ id: "a", title: "Old", link: "https://x/a" }],
        current: [
          { id: "a", title: "Old", link: "https://x/a" },
          {
            id: "b",
            title: "RBI press changed",
            link: "https://x/b",
          },
        ],
      },
    });
    const body = await res.json();
    expect(body.verdict).toBeNull();
    expect(body.trips).toEqual([]);
  });

  test("NAMING: chip is RADAR 📡 not RAD", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("chip-radar")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chip-radar")).toHaveText(/RADAR\s*📡/);
    await expect(page.getByTestId("chip-radar")).not.toHaveText(/^RAD$/);
  });
});
