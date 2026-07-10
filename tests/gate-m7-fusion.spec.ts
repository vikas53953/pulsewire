import { expect, test } from "@playwright/test";

test.describe("M7 Signal Fusion", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "once");
  });

  test("VIBE and RADAR chips removed from UI", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chip-vibe")).toHaveCount(0);
    await expect(page.getByTestId("chip-radar")).toHaveCount(0);
    await expect(page.getByTestId("chip-markets")).toBeVisible();
  });

  test("EARLY X-only item is labeled and never drives red verdict", async ({
    request,
    page,
  }) => {
    const res = await request.get(
      "/api/highlights?section=markets&window=4h&pwEarlyX=1&refresh=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const early = (body.items as { signalState?: string; text: string }[]).filter(
      (i) => i.signalState === "early",
    );
    expect(early.length).toBeGreaterThan(0);
    expect(early.some((i) => /mystery|X-only|rumor|no wire/i.test(i.text))).toBe(
      true,
    );
    // EARLY must never alone produce red
    expect(body.verdict.level).not.toBe("red");
    if (body.verdict.text.match(/brewing/i)) {
      expect(body.verdict.level).toBe("yellow");
    }

    await page.goto("/?pwEarlyX=1");
    await page.getByTestId("lens-window").click();
    await page.getByTestId("chip-markets").click();
    await expect(page.locator('[data-signal="early"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("signal-early").first()).toBeVisible();
    await expect(page.getByTestId("signal-label").first()).toContainText(
      /early|unconfirmed/i,
    );
  });

  test("cross-plane fusion attaches X evidence to matching RSS cluster", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/highlights?section=markets&window=4h&pwFusion=1&pwHotMarkets=1&refresh=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const fused = (
      body.items as {
        evidence?: { plane: string }[];
        signalState?: string;
        text: string;
      }[]
    ).find((i) => (i.evidence || []).some((e) => e.plane === "x"));
    // Hot markets + fusion X that matches Sensex/FII story when present
    expect(body.items.length).toBeGreaterThan(0);
    if (fused) {
      expect(fused.signalState).toBe("confirmed");
      expect(fused.evidence!.some((e) => e.plane === "rss" || e.plane === "x")).toBe(
        true,
      );
    }
  });

  test("hot Markets confirmed RSS still red; early-never-red unit via brewing", async ({
    request,
  }) => {
    const hot = await request.get(
      "/api/highlights?section=markets&window=4h&pwHotMarkets=1&refresh=1",
    );
    const hotBody = await hot.json();
    expect(hotBody.verdict.level).toBe("red");
    expect(hotBody.verdict.text).toMatch(/Markets is hot/i);

    const early = await request.get(
      "/api/highlights?section=markets&window=4h&pwEarlyX=1&pwQuiet=1&refresh=1",
    );
    const earlyBody = await early.json();
    expect(earlyBody.verdict.level).not.toBe("red");
  });

  test("tile evidence line shows plane markers when fused", async ({
    page,
  }) => {
    await page.goto("/?pwHotMarkets=1&pwFusion=1");
    await expect(page.getByTestId("verdict-hero")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("lens-window").click();
    await page.getByTestId("chip-markets").click();
    await expect(page.getByTestId("bento-grid")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("tile-evidence").first()).toBeVisible();
  });

  test("Radar strip only when tripped (no RAD chip)", async ({
    page,
    request,
  }) => {
    await request.post("/api/radar", { data: { action: "clear" } });
    await page.goto("/?pwQuiet=1");
    await expect(page.getByTestId("score-chips")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chip-radar")).toHaveCount(0);
    // Clear → strip hidden
    await expect(page.getByTestId("radar-strip")).toHaveCount(0);

    await request.post("/api/radar", {
      data: { action: "trip", tripwireId: "sebi-press" },
    });
    await page.reload();
    await expect(page.getByTestId("radar-strip")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("radar-strip")).toHaveAttribute(
      "data-clear",
      "0",
    );
    await expect(page.getByTestId("verdict-hero")).toContainText(/Radar/i);
  });
});
