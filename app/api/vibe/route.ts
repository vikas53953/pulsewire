import { NextRequest, NextResponse } from "next/server";
import { clearVibeCacheForTests, getVibe } from "@/lib/vibe";
import {
  clearTestOverrides,
  parseTestOverrides,
  setTestOverrides,
} from "@/lib/test-mode";
import { isTimeWindow } from "@/lib/types";

export const dynamic = "force-dynamic";
// Vercel: cold warm cycle (parallel feeds, 8s timeout) needs headroom.
export const maxDuration = 60;
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const windowParam = searchParams.get("window") ?? "4h";
  const forceRefresh = searchParams.get("refresh") === "1";
  const overrides = parseTestOverrides(searchParams);

  if (!isTimeWindow(windowParam)) {
    return NextResponse.json({ error: "Invalid window" }, { status: 400 });
  }

  try {
    setTestOverrides(overrides);
    if (forceRefresh) clearVibeCacheForTests();
    const payload = await getVibe(windowParam, { forceRefresh });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } finally {
    clearTestOverrides();
  }
}
