import type { HighlightItem } from "./types";
import { windowToMs, type TimeWindow } from "./types";
import { enrichItemHeat } from "./score";

/** Earliest source timestamp — keeps older multi-source stories window-correct. */
export function earliestPublishedAt(isos: string[]): string {
  if (isos.length === 0) return new Date().toISOString();
  return isos.reduce((a, b) =>
    new Date(a).getTime() <= new Date(b).getTime() ? a : b
  );
}

const HEAT_FLOOR_RATIO = 0.15;
/** Raised from 9 → 16 so the board can show denser mix (owner feedback). */
const CAP = 16;
const FLOOR_COUNT = 2;

/**
 * SPEC v2 §5 ranking (cap raised for mix visibility):
 * 1) storyHeat desc
 * 2) age-diversity for 4h+ after top 3 (may pull one below-floor item per empty bucket)
 * 3) fewer-but-stronger: heat ≥ 15% of top, floor 2, cap 16
 */
export function rankAndCapForWindow(
  items: HighlightItem[],
  window: TimeWindow,
  _maxItemsIgnored: number,
  now = Date.now()
): HighlightItem[] {
  const maxAge = windowToMs(window);
  const filtered = items
    .filter((item) => {
      const age = now - new Date(item.publishedAt).getTime();
      return age >= 0 && age <= maxAge;
    })
    .map((i) => enrichItemHeat(i, now));

  if (filtered.length === 0) return [];

  filtered.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
  const topHeat = filtered[0].heat ?? 0;
  const floor = Math.max(0, topHeat * HEAT_FLOOR_RATIO);

  let strong = filtered.filter((i) => (i.heat ?? 0) >= floor);
  if (strong.length < FLOOR_COUNT) {
    strong = filtered.slice(0, Math.min(FLOOR_COUNT, filtered.length));
  }

  if (window === "1h" || strong.length <= 3) {
    return strong.slice(0, CAP);
  }

  const head = strong.slice(0, 3);
  const picked: HighlightItem[] = [...head];
  const pickedKeys = new Set(head.map(itemKey));

  const allBuckets = ageBuckets(
    filtered.filter((i) => !pickedKeys.has(itemKey(i))),
    window,
    now
  );
  const strongBuckets = ageBuckets(
    strong.filter((i) => !pickedKeys.has(itemKey(i))),
    window,
    now
  );

  // Reserve diversity first: one from each empty age bucket (may be below floor)
  for (let bi = 0; bi < 3 && picked.length < CAP; bi++) {
    const covered = picked.some((item) => bucketIndex(item, window, now) === bi);
    if (covered) continue;
    const candidate =
      strongBuckets[bi].find((i) => !pickedKeys.has(itemKey(i))) ||
      allBuckets[bi].find((i) => !pickedKeys.has(itemKey(i)));
    if (candidate) {
      picked.push(candidate);
      pickedKeys.add(itemKey(candidate));
    }
  }

  // Fill remaining by heat round-robin across strong buckets
  let added = 0;
  const maxRest = CAP - picked.length;
  for (let guard = 0; guard < 40 && added < maxRest; guard++) {
    let progressed = false;
    for (const bucket of strongBuckets) {
      if (added >= maxRest) break;
      while (bucket.length > 0) {
        const next = bucket.shift()!;
        if (pickedKeys.has(itemKey(next))) continue;
        picked.push(next);
        pickedKeys.add(itemKey(next));
        added++;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  return picked.slice(0, CAP);
}

function itemKey(item: HighlightItem): string {
  return `${item.publishedAt}|${item.text}`;
}

function bucketIndex(
  item: HighlightItem,
  window: TimeWindow,
  now: number
): number {
  const maxAge = windowToMs(window);
  const pct = (now - new Date(item.publishedAt).getTime()) / maxAge;
  if (pct <= 0.25) return 0;
  if (pct <= 0.5) return 1;
  return 2;
}

function ageBuckets(
  items: HighlightItem[],
  window: TimeWindow,
  now: number
): HighlightItem[][] {
  const maxAge = windowToMs(window);
  const b0: HighlightItem[] = [];
  const b1: HighlightItem[] = [];
  const b2: HighlightItem[] = [];

  for (const item of items) {
    const age = now - new Date(item.publishedAt).getTime();
    const pct = age / maxAge;
    if (pct <= 0.25) b0.push(item);
    else if (pct <= 0.5) b1.push(item);
    else b2.push(item);
  }

  const byHeat = (a: HighlightItem, b: HighlightItem) =>
    (b.heat ?? 0) - (a.heat ?? 0);
  return [b0.sort(byHeat), b1.sort(byHeat), b2.sort(byHeat)];
}

/** Filter items that appeared (or gained sources) after `since`. */
export function filterSince(
  items: HighlightItem[],
  sinceIso: string
): HighlightItem[] {
  const since = new Date(sinceIso).getTime();
  if (!Number.isFinite(since)) return items;

  return items.filter((item) => {
    const first = new Date(item.firstSeen || item.publishedAt).getTime();
    if (first > since) return true;
    return item.sources.some((s) => {
      const t = new Date(s.firstSeen || item.publishedAt).getTime();
      return t > since;
    });
  });
}
