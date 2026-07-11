import { flushDbNow } from "@/lib/sqldb";
import { NextRequest, NextResponse } from "next/server";
import {
  evaluateListingDiffForTests,
  getRadarStatus,
  pollRadar,
  setRadarForceTripForTests,
  startRadarPoller,
  type RadarListItem,
} from "@/lib/radar";
import { isTestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";
// Vercel: cold warm cycle (parallel feeds, 8s timeout) needs headroom.
export const maxDuration = 60;
export const revalidate = 0;

startRadarPoller();

export async function GET() {
  startRadarPoller();
  return NextResponse.json(getRadarStatus(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  if (!isTestMode()) {
    return NextResponse.json({ error: "PW_TEST only" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    tripwireId?: string;
  };
  if (body.action === "trip") {
    setRadarForceTripForTests(body.tripwireId || "sebi-press");
    const status = await pollRadar();
    return NextResponse.json(status);
  }
  if (body.action === "clear") {
    setRadarForceTripForTests(null);
    const status = await pollRadar();
    return NextResponse.json(status);
  }
  if (body.action === "reset-state") {
    const { resetRadarStateForTests } = await import("@/lib/radar");
    resetRadarStateForTests();
    const status = await pollRadar();
    return NextResponse.json(status);
  }
  /** Pure listing-diff fixture (BUG-V2) — no network. */
  if (body.action === "diff-fixture") {
    const previous = (body as { previous?: RadarListItem[] }).previous ?? [];
    const current = (body as { current?: RadarListItem[] }).current ?? [];
    const sourceName =
      (body as { sourceName?: string }).sourceName || "RBI press";
    return NextResponse.json(
      evaluateListingDiffForTests(sourceName, previous, current),
    );
  }
  await flushDbNow();
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
