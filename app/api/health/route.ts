import { NextResponse } from "next/server";
import path from "path";
import { listCacheStats } from "@/lib/cache";
import { getHistoryDb, resolveHistoryDbPath } from "@/lib/history";
import { isLlmConfigured } from "@/lib/llm";
import { getWarmerStats } from "@/lib/warmer";
import { getXGovernorStatus } from "@/lib/x-governor";
import { isBetaGateEnabled } from "@/lib/beta-auth";
import { CONTENT_SECTIONS } from "@/lib/feeds.config";
import { getUsageStats } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function historyStats(): {
  path: string;
  rowCount: number;
  schemaVersion: number | null;
} {
  const full = resolveHistoryDbPath();
  const basename = path.basename(full);
  try {
    const db = getHistoryDb();
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM section_history`)
      .get() as { n: number };
    let schemaVersion: number | null = null;
    try {
      const v = db
        .prepare(`SELECT version FROM schema_version WHERE id = 1`)
        .get() as { version: number } | undefined;
      schemaVersion = v?.version ?? null;
    } catch {
      schemaVersion = null;
    }
    return { path: basename, rowCount: row.n, schemaVersion };
  } catch {
    return { path: basename, rowCount: 0, schemaVersion: null };
  }
}

export async function GET() {
  const summarize = process.env.LLM_SUMMARIZE === "1";
  const cache = listCacheStats();
  const warmer = getWarmerStats();
  const x = getXGovernorStatus();
  const history = historyStats();
  const usage = getUsageStats();

  // Ensure content sections appear even before first warm
  const known = new Set(cache.map((c) => c.section));
  for (const s of ["all", ...CONTENT_SECTIONS]) {
    if (!known.has(s)) {
      cache.push({
        section: s,
        ageMs: 0,
        fresh: false,
        itemCount: 0,
        rawMode: true,
        sourcesUnreachable: false,
        generatedAt: null,
      });
    }
  }
  cache.sort((a, b) => a.section.localeCompare(b.section));

  return NextResponse.json(
    {
      ok: true,
      at: new Date().toISOString(),
      betaGate: isBetaGateEnabled(),
      llm: {
        configured: isLlmConfigured(),
        summarize,
        mode: summarize && isLlmConfigured() ? "polished" : "raw",
      },
      warmer,
      xGovernor: {
        dailyUsed: x.dailyUsed,
        dailyCap: x.dailyCap,
        monthlyUsed: x.monthlyUsed,
        monthlyCap: x.monthlyCap,
        paused: x.paused,
        pauseNote: x.pauseNote,
        manualDeepUsedToday: x.manualDeepUsedToday,
        manualDeepCap: x.manualDeepCap,
        lastCall: x.lastCall ?? null,
      },
      history,
      usage,
      cache,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
