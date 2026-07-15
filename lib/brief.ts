import { getHistoryDb } from "./history";
import { isLlmConfigured } from "./llm";
import { isLlmFailForced, isTestMode } from "./test-mode";

export interface BriefLines {
  whatHappened: string;
  whyItMatters: string;
  whosAffected: string;
  whatsNext: string;
}

export interface BriefPayload {
  clusterId: string;
  title: string;
  lines: BriefLines | null;
  rawMode: boolean;
  cached: boolean;
  sources: { name: string; url: string }[];
  /** SPEC v4 — social-led clusters only. */
  socialFirst?: string;
}

function ensureBriefsTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS briefs (
      cluster_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      what_happened TEXT,
      why_it_matters TEXT,
      whos_affected TEXT,
      whats_next TEXT,
      raw_mode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

function readCached(clusterId: string): BriefPayload | null {
  ensureBriefsTable();
  const db = getHistoryDb();
  const row = db
    .prepare(
      `SELECT cluster_id, title, what_happened, why_it_matters, whos_affected, whats_next, raw_mode
       FROM briefs WHERE cluster_id = ?`
    )
    .get(clusterId) as
    | {
        cluster_id: string;
        title: string;
        what_happened: string | null;
        why_it_matters: string | null;
        whos_affected: string | null;
        whats_next: string | null;
        raw_mode: number;
      }
    | undefined;
  if (!row) return null;
  const rawMode = Boolean(row.raw_mode);
  return {
    clusterId: row.cluster_id,
    title: row.title,
    rawMode,
    cached: true,
    sources: [],
    lines: rawMode
      ? null
      : {
          whatHappened: row.what_happened || "",
          whyItMatters: row.why_it_matters || "",
          whosAffected: row.whos_affected || "",
          whatsNext: row.whats_next || "",
        },
  };
}

function writeCache(input: {
  clusterId: string;
  title: string;
  lines: BriefLines | null;
  rawMode: boolean;
}): void {
  ensureBriefsTable();
  const db = getHistoryDb();
  db.prepare(
    `INSERT OR REPLACE INTO briefs
      (cluster_id, title, what_happened, why_it_matters, whos_affected, whats_next, raw_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.clusterId,
    input.title,
    input.lines?.whatHappened ?? null,
    input.lines?.whyItMatters ?? null,
    input.lines?.whosAffected ?? null,
    input.lines?.whatsNext ?? null,
    input.rawMode ? 1 : 0,
    new Date().toISOString()
  );
}

function fixtureBrief(title: string): BriefLines {
  return {
    whatHappened: `${title.slice(0, 80)} — confirmed across desks.`,
    whyItMatters: "Moves the tape and desk attention for the next session.",
    whosAffected: "Traders, desks watching India markets, and related sectors.",
    whatsNext: "Watch follow-through into the next window; no full article here.",
  };
}

function getEnv(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

async function callLlmBrief(input: {
  title: string;
  sources: { name: string; url: string }[];
}): Promise<BriefLines | null> {
  const apiKey = getEnv("LLM_API_KEY");
  if (!apiKey) return null;
  const baseUrl = getEnv("LLM_BASE_URL", "https://api.x.ai/v1").replace(/\/$/, "");
  const model = getEnv("LLM_MODEL", "grok-4.5");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You write PulseWire Briefs. Return ONLY JSON:
{ "whatHappened": "...", "whyItMatters": "...", "whosAffected": "...", "whatsNext": "..." }
Each value ≤140 chars, factual, no opinion, no invented facts. Base only on the title and source names given.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              title: input.title,
              sources: input.sources.map((s) => s.name),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text) as BriefLines;
    if (
      !parsed?.whatHappened ||
      !parsed?.whyItMatters ||
      !parsed?.whosAffected ||
      !parsed?.whatsNext
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One LLM call per clusterId, ever. RAW / fail → lines=null (title+sources only).
 */
export async function getBrief(input: {
  clusterId: string;
  title: string;
  sources: { name: string; url: string }[];
  forceRaw?: boolean;
  socialFirst?: string;
}): Promise<BriefPayload> {
  // A reduced/raw fallback is NOT a completed Brief — never serve a cached raw
  // row as if it were one. Ignoring it lets a future evidence-backed capability
  // regenerate this cluster instead of being pinned to "sources only" forever.
  const cached = readCached(input.clusterId);
  if (cached && !cached.rawMode) {
    return {
      ...cached,
      sources: input.sources,
      title: cached.title || input.title,
      socialFirst: input.socialFirst || cached.socialFirst,
    };
  }

  const forceRaw =
    input.forceRaw ||
    (isTestMode() && isLlmFailForced()) ||
    (!isTestMode() && !isLlmConfigured()) ||
    // Cost guard — Brief LLM off unless LLM_SUMMARIZE=1
    (!isTestMode() && (process.env.LLM_SUMMARIZE ?? "0").trim() !== "1");

  if (forceRaw) {
    // No writeCache — a "sources only" view is a capability gap, not a result.
    return {
      clusterId: input.clusterId,
      title: input.title,
      lines: null,
      rawMode: true,
      cached: false,
      sources: input.sources,
      socialFirst: input.socialFirst,
    };
  }

  let lines: BriefLines | null = null;
  if (isTestMode()) {
    lines = fixtureBrief(input.title);
  } else {
    lines = await callLlmBrief(input);
  }

  const rawMode = !lines;
  writeCache({
    clusterId: input.clusterId,
    title: input.title,
    lines,
    rawMode,
  });

  return {
    clusterId: input.clusterId,
    title: input.title,
    lines,
    rawMode,
    cached: false,
    sources: input.sources,
    socialFirst: input.socialFirst,
  };
}

/** Test helper */
export function resetBriefsForTests(): void {
  ensureBriefsTable();
  getHistoryDb().exec(`DELETE FROM briefs`);
}
