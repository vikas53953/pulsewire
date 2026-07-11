import { NextRequest, NextResponse } from "next/server";
import { canSpend, spendForbiddenResponse } from "@/lib/beta-auth";
import { clearCache } from "@/lib/cache";
import { getHighlights } from "@/lib/highlights";
import {
  clearTestOverrides,
  parseTestOverrides,
  setTestOverrides,
} from "@/lib/test-mode";
import { startBackgroundWarmer } from "@/lib/warmer";
import { isLens, isSectionId, isTimeWindow } from "@/lib/types";

export const dynamic = "force-dynamic";
// Vercel: cold warm cycle (parallel feeds, 8s timeout) needs headroom.
export const maxDuration = 60;
export const revalidate = 0;

startBackgroundWarmer();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sectionParam = searchParams.get("section") ?? "all";
  const windowParam = searchParams.get("window") ?? "4h";
  const lensParam = searchParams.get("lens") ?? "window";
  const sinceParam = searchParams.get("since") ?? undefined;
  const forceRefresh = searchParams.get("refresh") === "1";
  const overrides = parseTestOverrides(searchParams);

  if (forceRefresh && !canSpend(request)) {
    return spendForbiddenResponse();
  }

  if (!isSectionId(sectionParam)) {
    return NextResponse.json(
      {
        error: `Invalid section. Use one of: all, india, markets, economy, politics, sports, world, tech, trend, xpulse, vibe, radar`,
      },
      { status: 400 }
    );
  }

  if (!isTimeWindow(windowParam)) {
    return NextResponse.json(
      { error: "Invalid window. Use one of: 1h, 4h, 12h, 24h" },
      { status: 400 }
    );
  }

  if (!isLens(lensParam)) {
    return NextResponse.json(
      { error: "Invalid lens. Use window or since" },
      { status: 400 }
    );
  }

  // Pool-shape overrides replace the fixture set; must bust cache in/out.
  // llmFail/feedsDown keep the same pool — leave cache so short-TTL HIT tests work.
  const poolOverride = Boolean(
    overrides.empty ||
      overrides.quiet ||
      overrides.hotMarkets ||
      overrides.earlyX ||
      overrides.fusion
  );
  const overrideBust = Boolean(
    overrides.llmFail || overrides.feedsDown || poolOverride
  );

  try {
    setTestOverrides(overrides);

    if (forceRefresh || overrideBust) {
      console.info(
        `[pulsewire] cache-miss ${forceRefresh ? "manual refresh" : "test override"} section=${sectionParam}`
      );
      clearCache();
    }

    const payload = await getHighlights({
      section: sectionParam,
      window: windowParam,
      lens: lensParam,
      since: sinceParam,
      forceRefresh: forceRefresh || overrideBust,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...(payload.cacheMiss
          ? { "X-PulseWire-Cache": "MISS" }
          : { "X-PulseWire-Cache": "HIT" }),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pulsewire] /api/highlights failed:", message);
    return NextResponse.json(
      { error: "Failed to load highlights", detail: message },
      { status: 500 }
    );
  } finally {
    clearTestOverrides();
    // Quiet/hot/empty/feedsDown pools must not poison the shared cache.
    if (poolOverride || overrides.feedsDown) clearCache();
  }
}
