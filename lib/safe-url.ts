/**
 * Allowlist http(s) only — closes javascript:/data: XSS if a feed supplies a bad link.
 */

export function isSafeHttpUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Return the URL if safe, otherwise empty string (caller should drop the item). */
export function sanitizeHttpUrl(url: string): string {
  const trimmed = (url || "").trim();
  return isSafeHttpUrl(trimmed) ? trimmed : "";
}
