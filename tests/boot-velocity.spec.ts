import { expect, test } from "@playwright/test";

/**
 * Boot-window velocity trap regression.
 * Hot Markets fixture stamps firstSeen = publishedAt (staggered ages), so it
 * must still score RED. Separately, we assert the score helper via a tiny
 * debug query that only works in PW_TEST.
 */
test.describe("boot velocity suppression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "once");
  });

  test("hot fixture still red (real staggered firstSeen ≠ boot trap)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/highlights?section=all&window=4h&lens=window&pwHotMarkets=1&refresh=1"
    );
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.verdict.level).toBe("red");
    const mkt = json.scores.find(
      (s: { section: string }) => s.section === "markets"
    );
    expect(mkt.level).toBe("red");
    // Real velocity from staggered publishedAt ages — not suppressed
    expect(mkt.topVelocity).toBeGreaterThanOrEqual(3);
  });

  test("quiet fixture never false-red after refresh (boot-safe)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/highlights?section=all&window=4h&lens=window&pwQuiet=1&refresh=1"
    );
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.verdict.level).toBe("green");
    expect(
      json.scores.every((s: { level: string }) => s.level === "green")
    ).toBeTruthy();
  });
});
