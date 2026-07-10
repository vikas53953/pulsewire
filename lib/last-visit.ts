/** Client-side "last visit" helpers for NEW stickers. */

export const LAST_VISIT_KEY = "pulsewire-last-visit";

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
