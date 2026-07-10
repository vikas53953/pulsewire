/**
 * Full flash headlines — SPEC v2 §6.
 * Target 140–160 chars, end on a full word. Never mid-phrase chop.
 */
export function flashHeadline(title: string, max = 160): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace < max * 0.6) {
    return `${slice.trimEnd()}…`;
  }
  return `${slice.slice(0, lastSpace).trimEnd()}…`;
}

/** @deprecated use flashHeadline — kept as alias for older imports */
export function trimTitle(title: string, max = 160): string {
  return flashHeadline(title, max);
}
