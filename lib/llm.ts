import { isLlmFailForced, isTestMode } from "./test-mode";
import type { RawFeedItem } from "./types";

const SYSTEM_PROMPT = `You are a wire-desk editor for PulseWire. You receive raw news items. Return ONLY valid JSON:
{ "highlights": [ { "ids": [merged item ids], "text": "<one full flash headline, 140-160 chars max, who+what+why it matters, no opinion, no clickbait>", "merged": true|false } ] }
Rules: merge items that describe the same event; never invent facts not present
in the input; keep numbers and names exact; write a COMPLETE readable headline
(not a truncated teaser); end on a full word; neutral English.`;

export interface LlmHighlightRow {
  ids: string[];
  text: string;
  merged: boolean;
}

export interface LlmResult {
  highlights: LlmHighlightRow[];
  rawMode: boolean;
  error?: string;
}

function getEnv(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function isLlmConfigured(): boolean {
  return Boolean(getEnv("LLM_API_KEY"));
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseLlmJson(text: string): LlmHighlightRow[] | null {
  try {
    const parsed = JSON.parse(stripFences(text)) as {
      highlights?: Array<{ ids?: unknown; text?: unknown; merged?: unknown }>;
    };
    if (!parsed?.highlights || !Array.isArray(parsed.highlights)) return null;

    const rows: LlmHighlightRow[] = [];
    for (const row of parsed.highlights) {
      if (!row || typeof row.text !== "string") continue;
      const ids = Array.isArray(row.ids)
        ? row.ids.filter((id): id is string => typeof id === "string")
        : [];
      if (ids.length === 0) continue;
      rows.push({
        ids,
        text: row.text.trim(),
        merged: Boolean(row.merged) || ids.length > 1,
      });
    }
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/**
 * One batched LLM call per section refresh. On any failure → rawMode.
 */
function stubLlm(items: RawFeedItem[]): LlmResult {
  // Deterministic stub: group by exact title, rewrite as one-line highlight
  const byTitle = new Map<string, RawFeedItem[]>();
  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    const list = byTitle.get(key) ?? [];
    list.push(item);
    byTitle.set(key, list);
  }
  const highlights: LlmHighlightRow[] = [];
  for (const group of Array.from(byTitle.values())) {
    const sources = new Set(group.map((g) => g.source));
    highlights.push({
      ids: group.map((g) => g.id),
      text: group[0].title.slice(0, 160),
      merged: sources.size >= 2,
    });
  }
  return { highlights, rawMode: false };
}

export async function summarizeAndDedupe(
  items: RawFeedItem[]
): Promise<LlmResult> {
  if (!items.length) {
    return { highlights: [], rawMode: true, error: "empty input" };
  }

  if (isTestMode()) {
    if (isLlmFailForced()) {
      return { highlights: [], rawMode: true, error: "PW_LLM_FAIL forced" };
    }
    return stubLlm(items);
  }

  if (!isLlmConfigured()) {
    return {
      highlights: [],
      rawMode: true,
      error: "LLM_API_KEY not set",
    };
  }

  // Cost guard: keep RSS in raw/merge mode unless explicitly enabled.
  // X Pulse uses x_search separately and is metered by X_PULSE_MONTHLY_CAP.
  if (getEnv("LLM_SUMMARIZE", "0") !== "1") {
    return {
      highlights: [],
      rawMode: true,
      error: "LLM_SUMMARIZE=0 — raw mode (set LLM_SUMMARIZE=1 to enable)",
    };
  }

  const baseUrl = getEnv("LLM_BASE_URL", "https://api.x.ai/v1").replace(
    /\/$/,
    ""
  );
  const model = getEnv("LLM_MODEL", "grok-4.5");
  const apiKey = getEnv("LLM_API_KEY");

  const payload = items.map((item) => ({
    id: item.id,
    title: item.title,
    snippet: item.snippet,
    source: item.source,
    publishedAt: item.publishedAt,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ items: payload }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        highlights: [],
        rawMode: true,
        error: `LLM HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const highlights = parseLlmJson(content);
    if (!highlights) {
      return {
        highlights: [],
        rawMode: true,
        error: "LLM returned unparseable JSON",
      };
    }

    return { highlights, rawMode: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] LLM failed: ${message}`);
    return { highlights: [], rawMode: true, error: message };
  } finally {
    clearTimeout(timer);
  }
}
