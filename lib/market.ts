import { isTestMode } from "./test-mode";

/**
 * Market snapshot for the rail — Nifty / Sensex / USD-INR via Yahoo Finance's
 * public chart endpoint (no API key). REAL data only: quotes are ~15m delayed
 * (labelled), briefly cached, and a fetch failure shows "quotes unreachable" —
 * never a placeholder, never a stale number presented as live.
 */
export interface MarketQuote {
  label: string;
  price: number;
  changePct: number;
}

export interface MarketSnapshot {
  ok: boolean;
  quotes: MarketQuote[];
  asOf: string;
  delayed: boolean;
  note?: string;
}

const SYMBOLS: { y: string; label: string; decimals: number }[] = [
  { y: "%5ENSEI", label: "NIFTY", decimals: 0 },
  { y: "%5EBSESN", label: "SENSEX", decimals: 0 },
  { y: "INR=X", label: "USD/INR", decimals: 2 },
];

const TTL_MS = 60_000;
let cache: { at: number; data: MarketSnapshot } | null = null;

async function fetchQuote(
  sym: { y: string; label: string; decimals: number },
  signal: AbortSignal,
): Promise<MarketQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym.y}?interval=1d&range=1d`;
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "PulseWire/1.0 (+market snapshot)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
      }>;
    };
  };
  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose;
  if (typeof price !== "number" || typeof prev !== "number" || prev === 0) {
    return null;
  }
  const round = (n: number) =>
    Math.round(n * 10 ** sym.decimals) / 10 ** sym.decimals;
  return {
    label: sym.label,
    price: round(price),
    changePct: Math.round(((price - prev) / prev) * 1000) / 10,
  };
}

function testFixture(): MarketSnapshot {
  return {
    ok: true,
    delayed: true,
    asOf: "2026-07-15T04:00:00.000Z",
    quotes: [
      { label: "NIFTY", price: 24812, changePct: 0.8 },
      { label: "SENSEX", price: 81364, changePct: 0.9 },
      { label: "USD/INR", price: 83.42, changePct: -0.1 },
    ],
  };
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (isTestMode()) return testFixture();
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const results = await Promise.all(
      SYMBOLS.map((s) => fetchQuote(s, controller.signal).catch(() => null)),
    );
    const quotes = results.filter((q): q is MarketQuote => q != null);
    const data: MarketSnapshot = quotes.length
      ? { ok: true, quotes, asOf: new Date().toISOString(), delayed: true }
      : {
          ok: false,
          quotes: [],
          asOf: new Date().toISOString(),
          delayed: true,
          note: "Quotes unreachable",
        };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return {
      ok: false,
      quotes: [],
      asOf: new Date().toISOString(),
      delayed: true,
      note: "Quotes unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}
