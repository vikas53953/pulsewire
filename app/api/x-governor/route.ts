import { NextRequest, NextResponse } from "next/server";
import {
  getXGovernorStatus,
  requestManualDeep,
  resetXGovernorForTests,
  setXGovernorForceDenyForTests,
  __testSetDailyUsed,
} from "@/lib/x-governor";
import { fetchXAfterGrant } from "@/lib/x-pulse";
import { isTestMode } from "@/lib/test-mode";
import { isSectionId, type ContentSectionId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(getXGovernorStatus(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    section?: string;
    used?: number;
  };

  if (body.action === "deep-refresh") {
    const section =
      body.section && isSectionId(body.section) && body.section !== "all"
        ? (body.section as ContentSectionId)
        : "all";
    const decision = requestManualDeep(section);
    if (!decision.allowed) {
      return NextResponse.json(
        { ok: false, decision, status: getXGovernorStatus() },
        { status: 429 },
      );
    }
    const entry = await fetchXAfterGrant(decision, "4h");
    return NextResponse.json({
      ok: true,
      decision,
      status: getXGovernorStatus(),
      items: entry.items.length,
    });
  }

  if (!isTestMode()) {
    return NextResponse.json({ error: "PW_TEST only" }, { status: 404 });
  }

  if (body.action === "reset") {
    resetXGovernorForTests();
    return NextResponse.json(getXGovernorStatus());
  }
  if (body.action === "force-deny") {
    setXGovernorForceDenyForTests(true);
    return NextResponse.json(getXGovernorStatus());
  }
  if (body.action === "clear-deny") {
    setXGovernorForceDenyForTests(false);
    return NextResponse.json(getXGovernorStatus());
  }
  if (body.action === "set-daily") {
    __testSetDailyUsed(Number(body.used ?? 20));
    return NextResponse.json(getXGovernorStatus());
  }
  if (body.action === "simulate-heat") {
    const {
      maybeEarnHeatEscalation,
      requestXSearch,
    } = await import("@/lib/x-governor");
    const { fetchXAfterGrant } = await import("@/lib/x-pulse");
    // Seed below yellow (records score) then cross — bypass PW_TEST auto-skip
    process.env.PW_X_GOV = "1";
    maybeEarnHeatEscalation({ section: "markets", score: 20 });
    const decision =
      maybeEarnHeatEscalation({ section: "markets", score: 55 }) ||
      requestXSearch({
        trigger: "heat_escalation",
        section: "markets",
        reason: "markets heat 55 crossed 🟡 — check social velocity",
      });
    if (decision.allowed) await fetchXAfterGrant(decision, "4h");
    delete process.env.PW_X_GOV;
    return NextResponse.json({ decision, status: getXGovernorStatus() });
  }
  if (body.action === "simulate-reddit") {
    process.env.PW_X_GOV = "1";
    const { maybeEarnRedditSpike } = await import("@/lib/x-governor");
    const { fetchXAfterGrant } = await import("@/lib/x-pulse");
    const decision = maybeEarnRedditSpike({
      section: "markets",
      title: "Fixture Reddit spike: FII flows overwhelm Sensex",
      velocity: 9,
    });
    delete process.env.PW_X_GOV;
    if (decision?.allowed) await fetchXAfterGrant(decision, "4h");
    return NextResponse.json({ decision, status: getXGovernorStatus() });
  }
  if (body.action === "simulate-tripwire") {
    process.env.PW_X_GOV = "1";
    const { maybeEarnTripwire } = await import("@/lib/x-governor");
    const { fetchXAfterGrant } = await import("@/lib/x-pulse");
    const decision = maybeEarnTripwire({
      title: "SEBI fixture circular on disclosure",
      sourceName: "SEBI releases",
      section: "markets",
    });
    delete process.env.PW_X_GOV;
    if (decision.allowed) await fetchXAfterGrant(decision, "4h");
    return NextResponse.json({ decision, status: getXGovernorStatus() });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
