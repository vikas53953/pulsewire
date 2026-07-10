import { NextRequest, NextResponse } from "next/server";
import {
  getRadarStatus,
  pollRadar,
  setRadarForceTripForTests,
  startRadarPoller,
} from "@/lib/radar";
import { isTestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";
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
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
