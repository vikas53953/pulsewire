/** Client-side "last visit" helpers for NEW stickers. */

export const LAST_VISIT_KEY = "pulsewire-last-visit";

/** Max NEW stickers on one board — dilution kills the signal. */
export const NEW_BADGE_CAP = 3;

export function readLastVisit(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Persist "now" as last visit (call on pagehide so this session stays marked NEW). */
export function writeLastVisit(at = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(at));
  } catch {
    // ignore quota / private mode
  }
}

export function isNewerThanLastVisit(
  publishedAt: string,
  lastVisit: number | null
): boolean {
  if (lastVisit == null) return false;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > lastVisit;
}

/**
 * Mark items newer than last visit, then cap to the hottest ≤NEW_BADGE_CAP.
 * Color/status law: NEW is a scarce signal, not wallpaper.
 */
export function applyNewBadges<
  T extends { publishedAt: string; heat?: number; isNew?: boolean },
>(items: T[], lastVisit: number | null, cap = NEW_BADGE_CAP): T[] {
  const flagged = items.map((item) => ({
    ...item,
    isNew: isNewerThanLastVisit(item.publishedAt, lastVisit),
  }));
  const eligible = flagged
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.isNew)
    .sort((a, b) => (b.item.heat ?? 0) - (a.item.heat ?? 0))
    .slice(0, Math.max(0, cap));
  const keep = new Set(eligible.map((row) => row.index));
  return flagged.map((item, index) => ({
    ...item,
    isNew: keep.has(index),
  }));
}
