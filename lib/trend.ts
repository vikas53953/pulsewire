import { isLikelyDuplicate } from "./similarity";
import { sanitizeHttpUrl } from "./safe-url";
import type { SocialSignal } from "./fusion";
import type {
  ContentSectionId,
  HighlightItem,
  SectionId,
  SocialTrendsPack,
  TrendItem,
  TrendPack,
  TrendPlane,
} from "./types";
import { sectionLabel } from "./types";

/** Desk mix: lean — 1–2 social, a few wires. */
const MIX_WIRES = 3;
const MIX_SOCIAL = 2;

/** Full TREND board — lean high-signal only (Soft-ship: not another dense feed). */
const FULL_REDDIT_CAP = 8;
const FULL_X_CAP = 6;

function toTrendItem(
  title: string,
  url: string,
  source: string,
  publishedAt: string,
  plane: TrendItem["plane"],
  section?: ContentSectionId,
  why?: string,
): TrendItem | null {
  const safe = sanitizeHttpUrl(url);
  if (!safe) return null;
  return { title, url: safe, source, publishedAt, plane, section, why };
}

function trendWhy(
  sig: SocialSignal,
  plane: "reddit" | "x",
): string | undefined {
  const ageMin = Math.max(
    1,
    Math.round((Date.now() - new Date(sig.publishedAt).getTime()) / 60_000),
  );
  const ageLabel =
    ageMin < 60 ? `${ageMin}m` : `${Math.round(ageMin / 60)}h`;
  const vel = sig.velocity ?? 0;
  const velBit =
    vel > 0 ? ` · vel ${Number.isInteger(vel) ? vel : vel.toFixed(1)}` : "";
  if (plane === "reddit") {
    if (vel >= 8) {
      return `Rising in ${sig.source}${velBit} · ${ageLabel}`;
    }
    if (vel >= 4) {
      return `Active in ${sig.source}${velBit} · ${ageLabel}`;
    }
    return `Surfaced from ${sig.source}${velBit} · ${ageLabel}`;
  }
  if (vel >= 5) {
    return `Loud on X (${sig.source})${velBit} · ${ageLabel}`;
  }
  return `On X · ${sig.source}${velBit} · ${ageLabel}`;
}

function isContentSection(id: SectionId): id is ContentSectionId {
  return (
    id !== "all" &&
    id !== "trend" &&
    id !== "xpulse" &&
    id !== "vibe" &&
    id !== "radar"
  );
}

/** Reddit/X signal belongs to this desk (no global bleed). */
export function signalMatchesSection(
  sig: SocialSignal,
  section: ContentSectionId,
): boolean {
  if (sig.sections?.includes(section)) return true;
  if (sig.section === section) return true;
  return false;
}

function itemKey(item: { url?: string; title: string }): string {
  const u = (item.url || "").trim().toLowerCase();
  if (u) return `u:${u}`;
  return `t:${item.title.trim().toLowerCase()}`;
}

/** Exclude anything already shown in the lean mix (URL or near-duplicate title). */
export function excludeMixDupes(
  candidates: TrendItem[],
  mixShown: TrendItem[],
): TrendItem[] {
  if (mixShown.length === 0) return candidates;
  const keys = new Set(mixShown.map(itemKey));
  return candidates.filter((c) => {
    if (keys.has(itemKey(c))) return false;
    return !mixShown.some(
      (m) =>
        m.plane === c.plane &&
        isLikelyDuplicate(m.title, c.title, 0.72),
    );
  });
}

function wiresFromItems(
  items: HighlightItem[],
  section: ContentSectionId,
): TrendItem[] {
  const filtered = items.filter(
    (i) => !i.section || i.section === section,
  );

  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const item of filtered) {
    if ((item.signalState ?? "confirmed") === "early") continue;
    const url = item.sources[0]?.url || "";
    const key = `${item.text}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = toTrendItem(
      item.text,
      url,
      item.sources[0]?.name || "wire",
      item.publishedAt,
      "rss",
      item.section && isContentSection(item.section)
        ? item.section
        : section,
    );
    if (!row) continue;
    out.push(row);
    if (out.length >= MIX_WIRES) break;
  }
  return out;
}

function redditForSection(
  signals: SocialSignal[],
  section: ContentSectionId,
  cap: number,
): TrendItem[] {
  const pool = signals
    .filter((s) => s.plane === "reddit" && signalMatchesSection(s, section))
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));

  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const sig of pool) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = toTrendItem(
      sig.title,
      sig.url,
      sig.source,
      sig.publishedAt,
      "reddit",
      section,
      trendWhy(sig, "reddit"),
    );
    if (!row) continue;
    out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * X for a desk: only items tagged for that section, or fuzzy-matched
 * to a wire already on that desk. Never dump the global X feed into every chip.
 */
function xForSection(
  signals: SocialSignal[],
  wires: HighlightItem[],
  section: ContentSectionId,
  cap: number,
): TrendItem[] {
  const sectionWires = wires.filter(
    (i) => !i.section || i.section === section,
  );
  const candidates = signals.filter((s) => s.plane === "x");
  const picked: SocialSignal[] = [];
  const seen = new Set<string>();

  for (const sig of candidates) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    if (signalMatchesSection(sig, section)) {
      seen.add(key);
      picked.push(sig);
      continue;
    }
    if (!sig.section && (!sig.sections || sig.sections.length === 0)) {
      const hit = sectionWires.some((w) =>
        isLikelyDuplicate(w.text, sig.title, 0.55),
      );
      if (hit) {
        seen.add(key);
        picked.push(sig);
      }
    }
  }

  picked.sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));
  return picked
    .slice(0, cap)
    .map((sig) =>
      toTrendItem(
        sig.title,
        sig.url,
        sig.source,
        sig.publishedAt,
        "x",
        section,
        trendWhy(sig, "x"),
      ),
    )
    .filter((row): row is TrendItem => row != null);
}

function planeStatus(items: TrendItem[], emptyNote: string): TrendPlane {
  if (items.length === 0) {
    return { status: "quiet", items: [], note: emptyNote };
  }
  return { status: "ok", items, note: null };
}

function signalsToTrendItems(
  signals: SocialSignal[],
  plane: "reddit" | "x",
  cap: number,
): TrendItem[] {
  const pool = signals
    .filter((s) => s.plane === plane)
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));
  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const sig of pool) {
    const key = sig.url || sig.title;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = toTrendItem(
      sig.title,
      sig.url,
      sig.source,
      sig.publishedAt,
      plane,
      sig.section,
      trendWhy(sig, plane),
    );
    if (!row) continue;
    out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Desk-scoped lean mix (1–2 Reddit / 1–2 X). Callers skip ALL.
 */
export function buildTrendPack(input: {
  section: SectionId;
  items: HighlightItem[];
  reddit: SocialSignal[];
  x: SocialSignal[];
}): TrendPack | null {
  if (!isContentSection(input.section)) return null;

  const section = input.section;
  const label = sectionLabel(section);
  const wires = wiresFromItems(input.items, section);
  const reddit = redditForSection(input.reddit, section, MIX_SOCIAL);
  const x = xForSection(input.x, input.items, section, MIX_SOCIAL);

  return {
    wires: planeStatus(wires, `Quiet on ${label} wires.`),
    reddit: planeStatus(
      reddit,
      `Quiet on Reddit for ${label} — nothing loud in this desk’s subs.`,
    ),
    x: planeStatus(
      x,
      `Quiet on X for ${label} — no matching pulse yet.`,
    ),
  };
}

/**
 * Full social board — all Reddit + all X across every category.
 * `excludeFromMix` removes anything already shown in the lean desk mix.
 * When X is unconfigured, status is `needs_key` — never fake quiet.
 */
export function buildSocialTrendsPack(input: {
  reddit: SocialSignal[];
  x: SocialSignal[];
  excludeFromMix?: TrendItem[];
  /** False when LLM_API_KEY is missing (live). Test mode always configured. */
  xConfigured?: boolean;
}): SocialTrendsPack {
  const exclude = input.excludeFromMix ?? [];
  const redditAll = excludeMixDupes(
    signalsToTrendItems(input.reddit, "reddit", FULL_REDDIT_CAP),
    exclude.filter((i) => i.plane === "reddit"),
  );
  const xAll = excludeMixDupes(
    signalsToTrendItems(input.x, "x", FULL_X_CAP),
    exclude.filter((i) => i.plane === "x"),
  );

  let xPlane: TrendPlane;
  if (xAll.length > 0) {
    xPlane = planeStatus(xAll, "Quiet on X — no earned/cached pulse yet.");
  } else if (input.xConfigured === false) {
    xPlane = {
      status: "needs_key",
      items: [],
      note: "X plane off — no API key configured",
    };
  } else {
    xPlane = planeStatus(xAll, "Quiet on X — no earned/cached pulse yet.");
  }

  return {
    reddit: planeStatus(
      redditAll,
      "Quiet on Reddit — fetched, nothing trending.",
    ),
    x: xPlane,
  };
}
