/**
 * Resolve Google News article redirect URLs to the publisher link when possible.
 * Falls back to the original URL if resolution fails (common — GN tokens are opaque).
 * Only fetches news.google.com — never arbitrary hosts (SSRF).
 */

import { sanitizeHttpUrl } from "./safe-url";

const RESOLVE_TIMEOUT_MS = 5_000;
const resolveCache = new Map<string, string>();

/** Only news.google.com — do not follow arbitrary *.google.com (SSRF surface). */
function isGoogleNewsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "news.google.com";
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<{ finalUrl: string; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PulseWire/1.0; +local news highlights)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const body = await res.text();
    return { finalUrl: res.url || url, body };
  } finally {
    clearTimeout(timer);
  }
}

function extractExternalUrl(html: string, pageUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:url["'][^>]+content=["'](https?:\/\/(?!news\.google)[^"']+)["']/i,
    /<link[^>]+rel=["']canonical["'][^>]+href=["'](https?:\/\/(?!news\.google)[^"']+)["']/i,
    /data-n-au=["'](https?:\/\/(?!news\.google)[^"']+)["']/i,
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=(https?:\/\/(?!news\.google)[^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }

  // Protobuf / base64 payload sometimes embeds a raw http URL
  try {
    const token = new URL(pageUrl).pathname.split("/").pop() ?? "";
    if (token.length > 20) {
      const padded = token + "=".repeat((4 - (token.length % 4)) % 4);
      const raw = Buffer.from(padded, "base64url").toString("latin1");
      const found = raw.match(/https?:\/\/[^\x00-\x1f\s"'<>]+/);
      if (found && !found[0].includes("news.google.com")) {
        return found[0].replace(/[.,);]+$/, "");
      }
    }
  } catch {
    // ignore decode failures
  }

  return null;
}

export async function resolveArticleUrl(url: string): Promise<string> {
  const input = sanitizeHttpUrl(url);
  if (!input || !isGoogleNewsUrl(input)) return input || url;
  const cached = resolveCache.get(input);
  if (cached) return cached;

  try {
    const { finalUrl, body } = await fetchText(input);
    const safeFinal = sanitizeHttpUrl(finalUrl);
    if (safeFinal && !isGoogleNewsUrl(safeFinal)) {
      resolveCache.set(input, safeFinal);
      return safeFinal;
    }
    const extracted = sanitizeHttpUrl(
      extractExternalUrl(body, finalUrl || input) ?? ""
    );
    if (extracted) {
      resolveCache.set(input, extracted);
      return extracted;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] GN resolve failed: ${message}`);
  }

  resolveCache.set(input, input);
  return input;
}

export async function resolveArticleUrls(
  urls: string[],
  concurrency = 6
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const out = new Map<string, string>();
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const u = unique[idx];
      out.set(u, await resolveArticleUrl(u));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker())
  );
  return out;
}
