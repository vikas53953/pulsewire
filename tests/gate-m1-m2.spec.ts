import { expect, test, type APIRequestContext } from "@playwright/test";

async function api(
  request: APIRequestContext,
  section: string,
  window: string,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams({ section, window, ...extra });
  const res = await request.get(`/api/highlights?${params}`);
  expect(res.ok()).toBeTruthy();
  return { res, json: await res.json(), headers: res.headers() };
}

test.describe("M1/M2 API gate", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "API once");
  });

  test("API contract: stale, rawMode, generatedAt; item shape; window bound", async ({
    request,
  }) => {
    const { json } = await api(request, "markets", "4h");
    expect(json).toHaveProperty("stale");
    expect(json).toHaveProperty("rawMode");
    expect(json).toHaveProperty("generatedAt");
    expect(typeof json.generatedAt).toBe("string");
    expect(Array.isArray(json.items)).toBeTruthy();
    expect(json.items.length).toBeGreaterThan(0);

    const now = Date.now();
    const maxAge = 4 * 60 * 60 * 1000 + 5_000;
    for (const item of json.items) {
      expect(typeof item.text).toBe("string");
      expect(item.text.length).toBeGreaterThan(0);
      expect(Array.isArray(item.sources)).toBeTruthy();
      expect(item.sources.length).toBeGreaterThan(0);
      expect(item.sources[0].url).toMatch(/^https?:\/\//);
      expect(item.publishedAt).toBeTruthy();
      expect(now - new Date(item.publishedAt).getTime()).toBeLessThanOrEqual(
        maxAge
      );
    }
  });

  test("merge: duplicate fixture story is ONE hot item with ≥2 sources", async ({
    request,
  }) => {
    const { json } = await api(request, "markets", "24h");
    const matches = json.items.filter((i: { text: string }) =>
      i.text.includes("RBI holds rates")
    );
    expect(matches.length).toBe(1);
    expect(matches[0].hot).toBe(true);
    expect(matches[0].sources.length).toBeGreaterThanOrEqual(2);
  });

  test("raw fallback: LLM fail → rawMode, items, titles ≤110; short TTL re-attempt", async ({
    request,
  }) => {
    const first = await api(request, "tech", "4h", {
      pwLlmFail: "1",
      refresh: "1",
    });
    expect(first.json.rawMode).toBe(true);
    expect(first.json.cacheMiss).toBe(true);
    expect(first.json.items.length).toBeGreaterThan(0);
    for (const item of first.json.items) {
      expect(item.text.length).toBeLessThanOrEqual(110);
    }

    const hit = await api(request, "tech", "4h");
    expect(hit.json.rawMode).toBe(true);
    expect(hit.json.cacheMiss).toBeFalsy();
    expect(hit.headers["x-pulsewire-cache"]).toBe("HIT");

    // RAW_CACHE_TTL_MS=300 in webServer env (warmer interval disabled in PW_TEST)
    await new Promise((r) => setTimeout(r, 500));

    const expired = await api(request, "tech", "4h");
    // Expired → stale SWR path (still serves items) or miss rebuild
    expect(
      expired.json.stale === true || expired.json.cacheMiss === true
    ).toBeTruthy();

    const again = await api(request, "tech", "4h", {
      pwLlmFail: "1",
      refresh: "1",
    });
    expect(again.json.rawMode).toBe(true);
    expect(again.json.cacheMiss).toBe(true);
    expect(again.json.items.length).toBeGreaterThan(0);
  });
});
