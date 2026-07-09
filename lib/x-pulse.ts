import { getCache, getMaxItems, setCache, type CacheEntry } from "./cache";
import { isLlmConfigured } from "./llm";
import { rankAndCapForWindow } from "./rank";
import { isTestMode } from "./test-mode";
import type { HighlightItem, HighlightsResponse, TimeWindow } from "./types";

const globalForX = globalThis as unknown as {
  __pulsewireXPulseUsage?: Map<string, number>;
};

function usageMap(): Map<string, number> {
  if (!globalForX.__pulsewireXPulseUsage) {
    globalForX.__pulsewireXPulseUsage = new Map();
  }
  return globalForX.__pulsewireXPulseUsage;
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getXPulseMonthlyCap(): number {
  return Math.max(0, Number(process.env.X_PULSE_MONTHLY_CAP ?? "60"));
}

export function getXPulseUsage(): { month: string; used: number; cap: number } {
  const month = monthKey();
  return {
    month,
    used: usageMap().get(month) ?? 0,
    cap: getXPulseMonthlyCap(),
  };
}

function bumpUsage(): boolean {
  const { month, used, cap } = getXPulseUsage();
  if (used >= cap) return false;
  usageMap().set(month, used + 1);
  return true;
}

/** Test-only: reset monthly counter. */
export function resetXPulseUsageForTests(): void {
  usageMap().clear();
}

function getEnv(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function fixtureXPulseItems(): HighlightItem[] {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    {
      text: "X Pulse: markets buzz as Sensex futures spike after RBI hold",
      sources: [
        { name: "@marketswire", url: "https://x.com/marketswire/status/1" },
        { name: "@indiabiz", url: "https://x.com/indiabiz/status/2" },
      ],
      publishedAt: ago(25),
      hot: true,
      section: "xpulse",
    },
    {
      text: "X Pulse: cricket final trending — India fans flood the timeline",
      sources: [{ name: "@cricpulse", url: "https://x.com/cricpulse/status/3" }],
      publishedAt: ago(80),
      hot: false,
      section: "xpulse",
    },
    {
      text: "X Pulse: overnight tech layoff chatter cools after CEO clarification",
      sources: [{ name: "@techdesk", url: "https://x.com/techdesk/status/4" }],
      publishedAt: ago(700),
      hot: false,
      section: "xpulse",
    },
  ];
}

interface ParsedPulse {
  text: string;
  url?: string;
  handle?: string;
  publishedAt?: string;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parsePulseJson(text: string): ParsedPulse[] {
  try {
    const parsed = JSON.parse(stripFences(text)) as {
      pulses?: Array<Record<string, unknown>>;
    };
    if (!parsed?.pulses || !Array.isArray(parsed.pulses)) return [];
    const out: ParsedPulse[] = [];
    for (const row of parsed.pulses) {
      if (!row || typeof row.text !== "string") continue;
      out.push({
        text: row.text.trim().slice(0, 110),
        url: typeof row.url === "string" ? row.url : undefined,
        handle: typeof row.handle === "string" ? row.handle : undefined,
        publishedAt:
          typeof row.publishedAt === "string" ? row.publishedAt : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function extractOutputText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  if (typeof obj.output_text === "string") return obj.output_text;
  const output = obj.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (entry.type === "message" && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (
          part &&
          typeof part === "object" &&
          typeof (part as { text?: string }).text === "string"
        ) {
          chunks.push((part as { text: string }).text);
        }
      }
    }
  }
  return chunks.join("\n");
}

function extractCitations(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.citations)) {
    return obj.citations.filter((c): c is string => typeof c === "string");
  }
  return [];
}

async function callXSearch(window: TimeWindow): Promise<{
  items: HighlightItem[];
  rawMode: boolean;
  error?: string;
}> {
  if (!isLlmConfigured()) {
    return {
      items: [],
      rawMode: true,
      error: "LLM_API_KEY not set — X Pulse needs Grok + x_search",
    };
  }

  const baseUrl = getEnv("LLM_BASE_URL", "https://api.x.ai/v1").replace(
    /\/$/,
    ""
  );
  const model = getEnv("LLM_MODEL", "grok-4.5");
  const apiKey = getEnv("LLM_API_KEY");

  const hours =
    window === "1h" ? 1 : window === "4h" ? 4 : window === "12h" ? 12 : 24;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const fromDate = from.toISOString().slice(0, 10);

  const prompt = `You are PulseWire's X Pulse desk. Using x_search, find the hottest India-relevant breaking chatter on X in the last ${hours}h (markets, politics, cricket, tech, world shocks that Indians are talking about).
Return ONLY valid JSON:
{ "pulses": [ { "text": "<one factual sentence, max 20 words>", "handle": "@user", "url": "https://x.com/...", "publishedAt": "<ISO8601 if known>" } ] }
Rules: max 8 pulses; never invent posts; prefer high-engagement / multi-account stories; if unsure of URL use the citation link; no opinions.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "x_search",
            from_date: fromDate,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        items: [],
        rawMode: true,
        error: `X Pulse HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const text = extractOutputText(data);
    const citations = extractCitations(data);
    const parsed = parsePulseJson(text);

    const items: HighlightItem[] = parsed.map((p, i) => {
      const url =
        p.url ||
        citations[i] ||
        (p.handle
          ? `https://x.com/${p.handle.replace(/^@/, "")}`
          : "https://x.com");
      const handle = p.handle?.replace(/^@/, "") || "X";
      const publishedAt = p.publishedAt || new Date().toISOString();
      return {
        text: p.text.startsWith("X Pulse:") ? p.text : `X Pulse: ${p.text}`,
        sources: [{ name: `@${handle}`, url }],
        publishedAt,
        hot: i === 0,
        section: "xpulse",
      };
    });

    return { items, rawMode: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] X Pulse failed: ${message}`);
    return { items: [], rawMode: true, error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function buildXPulseEntry(): Promise<CacheEntry> {
  if (isTestMode()) {
    return {
      section: "xpulse",
      generatedAt: new Date().toISOString(),
      items: fixtureXPulseItems(),
      rawMode: false,
      sourcesUnreachable: false,
      poolCount: fixtureXPulseItems().length,
    };
  }

  if (!bumpUsage()) {
    console.warn("[pulsewire] X Pulse monthly cap reached");
    const cached = getCache("xpulse");
    if (cached.entry) {
      return { ...cached.entry, sourcesUnreachable: true };
    }
    return {
      section: "xpulse",
      generatedAt: new Date().toISOString(),
      items: [],
      rawMode: true,
      sourcesUnreachable: true,
      poolCount: 0,
    };
  }

  const result = await callXSearch("24h");
  if (result.error) {
    console.warn(`[pulsewire] X Pulse: ${result.error}`);
  }

  return {
    section: "xpulse",
    generatedAt: new Date().toISOString(),
    items: result.items,
    rawMode: result.rawMode,
    sourcesUnreachable: result.items.length === 0 && result.rawMode,
    poolCount: result.items.length,
  };
}

export async function refreshXPulse(): Promise<CacheEntry> {
  const entry = await buildXPulseEntry();
  setCache("xpulse", entry);
  return entry;
}

export async function getXPulseHighlights(options: {
  window: TimeWindow;
  forceRefresh?: boolean;
}): Promise<HighlightsResponse> {
  const { window, forceRefresh = false } = options;

  if (forceRefresh) {
    console.info(`[pulsewire] cache-miss force refresh section=xpulse window=${window}`);
  }

  if (!forceRefresh) {
    const cached = getCache("xpulse");
    if (cached.entry && cached.fresh) {
      return {
        section: "xpulse",
        window,
        generatedAt: cached.entry.generatedAt,
        stale: false,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        cacheMiss: false,
        xPulseUsage: getXPulseUsage(),
        items: rankAndCapForWindow(cached.entry.items, window, getMaxItems()),
      };
    }
    if (cached.entry && cached.entry.items.length > 0) {
      void refreshXPulse();
      return {
        section: "xpulse",
        window,
        generatedAt: cached.entry.generatedAt,
        stale: true,
        rawMode: cached.entry.rawMode,
        sourcesUnreachable: cached.entry.sourcesUnreachable,
        cacheMiss: false,
        xPulseUsage: getXPulseUsage(),
        items: rankAndCapForWindow(cached.entry.items, window, getMaxItems()),
      };
    }
  }

  const entry = await refreshXPulse();
  return {
    section: "xpulse",
    window,
    generatedAt: entry.generatedAt,
    stale: false,
    rawMode: entry.rawMode,
    sourcesUnreachable: entry.sourcesUnreachable,
    cacheMiss: true,
    xPulseUsage: getXPulseUsage(),
    items: rankAndCapForWindow(entry.items, window, getMaxItems()),
  };
}
