import { expect, test } from "@playwright/test";

/**
 * @live smoke — external integrations.
 * Run manually before any gate report: `npm run test:e2e:live`
 * Excluded from default CI (`grepInvert: /@live/`).
 *
 * Fixtures prove logic. These prove reality (Reddit RSS, Radar feeds, X key).
 */
test.describe("@live external smoke", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "once");
  });

  test("@live Reddit RSS returns items or honest failed (never silent quiet)", async ({
    request,
  }) => {
    const res = await request.get("/api/vibe?window=4h&refresh=1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.reddit).toBeTruthy();
    expect(["ok", "quiet", "failed"]).toContain(body.reddit.status);
    if (body.reddit.status === "ok") {
      expect(body.reddit.items.length).toBeGreaterThan(0);
      expect(body.reddit.items[0].title.length).toBeGreaterThan(3);
    }
    if (body.reddit.status === "quiet") {
      expect(body.reddit.items).toEqual([]);
      expect(String(body.reddit.note)).toMatch(/quiet/i);
    }
    if (body.reddit.status === "failed") {
      expect(String(body.reddit.note)).toMatch(/fail/i);
    }
  });

  test("@live X column is ok|quiet|failed|needs_key — never fake quiet", async ({
    request,
  }) => {
    const res = await request.get("/api/vibe?window=4h&refresh=1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(["ok", "quiet", "failed", "needs_key"]).toContain(
      body.xpulse.status,
    );
    if (body.xpulse.status === "needs_key") {
      expect(String(body.xpulse.note)).toMatch(/LLM_API_KEY|x_search|0 calls/i);
    }
  });

  test("@live Radar poll returns CLEAR or trips with real headlines", async ({
    request,
  }) => {
    const res = await request.get("/api/radar");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.clear).toBe("boolean");
    expect(Array.isArray(body.trips)).toBeTruthy();
    for (const t of body.trips) {
      expect(t.title.length).toBeGreaterThan(7);
      expect(t.title).not.toMatch(/changed$/i);
    }
    if (body.verdictHint) {
      expect(body.verdictHint.text).toMatch(/🔴 Radar:/);
      expect(body.verdictHint.text).not.toMatch(/changed$/i);
    }
  });

  test("@live one earned X call via deep-refresh logs trigger reason", async ({
    request,
  }) => {
    // Manual deep refresh is an earned trigger (SPEC §4.4). One call only.
    const before = await (await request.get("/api/x-governor")).json();
    const res = await request.post("/api/x-governor", {
      data: { action: "deep-refresh", section: "markets" },
    });
    // May 429 if capped — still assert honest response
    const body = await res.json();
    if (res.ok()) {
      expect(body.decision.trigger).toBe("manual_deep");
      expect(body.status.lastCall.reason).toMatch(/deep refresh/i);
      expect(body.status.dailyUsed).toBeGreaterThanOrEqual(
        (before.dailyUsed ?? 0) + 1,
      );
      console.info(
        `[live-smoke] x earned trigger=${body.decision.trigger} used=${body.status.dailyUsed}/${body.status.dailyCap}`,
      );
    } else {
      expect(body.decision.allowed).toBe(false);
      expect(String(body.decision.reason)).toMatch(/cap|cooldown|deny/i);
      console.info(`[live-smoke] x denied: ${body.decision.reason}`);
    }
  });
});
