import { NextRequest, NextResponse } from "next/server";
import {
  closeHistoryDbForTests,
  countHistorySamples,
  getHistoryDb,
  istBucketParts,
  resetHistoryForTests,
  seedHistoryForTests,
} from "@/lib/history";
import { mad, median, sigmoid } from "@/lib/baseline";
import { isTestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";

/** PW_TEST-only history introspection + seeding for M5 gate. */
export async function GET() {
  if (!isTestMode()) {
    return NextResponse.json({ error: "PW_TEST only" }, { status: 404 });
  }
  try {
    const db = getHistoryDb();
    const path =
      process.env.PULSEWIRE_DB_PATH ||
      (db as unknown as { name?: string }).name ||
      null;
    return NextResponse.json({
      enabled: true,
      path,
      count: countHistorySamples(),
      bucket: istBucketParts(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ enabled: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isTestMode()) {
    return NextResponse.json({ error: "PW_TEST only" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  };

  if (body.action === "assert-baseline-math") {
    const values = [6, 8, 10, 12, 14];
    const med = median(values);
    const m = mad(values, med);
    return NextResponse.json({
      ok: med === 10 && m === 2 && sigmoid(0) === 0.5,
      median: med,
      mad: m,
      sigmoid0: sigmoid(0),
    });
  }

  if (body.action === "seed-calibrated-markets") {
    resetHistoryForTests();
    const { hourIst, weekdayIst } = istBucketParts();
    const now = Date.now();
    const samples = [];
    // 16 quiet-ish baselines for markets in THIS hour×weekday bucket
    for (let i = 0; i < 16; i++) {
      samples.push({
        section: "markets" as const,
        timestamp: new Date(now - (16 - i) * 60 * 60 * 1000).toISOString(),
        sectionRaw: 3 + (i % 3) * 0.4,
        clusterCount: 2,
        topBreadth: 1,
        hourIst,
        weekdayIst,
      });
    }
    seedHistoryForTests(samples);
    return NextResponse.json({
      seeded: samples.length,
      hourIst,
      weekdayIst,
      count: countHistorySamples("markets"),
    });
  }

  if (body.action === "reset") {
    resetHistoryForTests();
    return NextResponse.json({ reset: true, count: 0 });
  }

  if (body.action === "reopen") {
    const before = countHistorySamples();
    closeHistoryDbForTests();
    getHistoryDb();
    return NextResponse.json({
      reopened: true,
      countBefore: before,
      countAfter: countHistorySamples(),
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
