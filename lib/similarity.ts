/**
 * Fuzzy title similarity for cross-feed duplicate detection.
 * Spec threshold: >= 0.6 means same story.
 *
 * Uses the max of:
 * - Dice coefficient on character bigrams (handles wording variants)
 * - Jaccard on significant tokens (handles shared entities/numbers)
 */

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip trailing " - Publisher" / " | Publisher" (Google News).
 * Requires spaced separators so "Ex-RBI", "Modi-Putin", "US-China" survive.
 * Refuses to leave a stub (<15 chars or <50% of original).
 */
export function stripPublisherSuffix(title: string): string {
  const original = title.trim();
  if (!original) return original;
  const stripped = original
    .replace(/\s+[-–—|]\s+[^-–—|]{2,60}$/, "")
    .trim();
  if (!stripped) return original;
  // Stub guard: refuse only when the remnant is both short AND a large cut
  // (OR would block legitimate "Some headline - The Hindu" → 13 chars).
  if (stripped.length < 15 && stripped.length < original.length * 0.5) {
    return original;
  }
  return stripped;
}

function lightStem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ers") && word.length > 4) return word.slice(0, -1);
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function tokens(title: string): string[] {
  return normalizeTitle(stripPublisherSuffix(title))
    .split(" ")
    .filter((w) => w.length > 1)
    .map(lightStem);
}

function bigrams(text: string): Map<string, number> {
  const s = normalizeTitle(stripPublisherSuffix(text)).replace(/\s+/g, "");
  const counts = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    counts.set(bg, (counts.get(bg) ?? 0) + 1);
  }
  return counts;
}

function diceBigrams(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const n of Array.from(ba.values())) totalA += n;
  for (const n of Array.from(bb.values())) totalB += n;
  for (const [bg, n] of Array.from(ba.entries())) {
    const m = bb.get(bg) ?? 0;
    overlap += Math.min(n, m);
  }
  return (2 * overlap) / (totalA + totalB);
}

function jaccardTokens(a: string, b: string): number {
  const sa = new Set(tokens(a));
  const sb = new Set(tokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of Array.from(sa)) {
    if (sb.has(t)) inter += 1;
  }
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function titleSimilarity(a: string, b: string): number {
  return Math.max(diceBigrams(a, b), jaccardTokens(a, b));
}

export function isLikelyDuplicate(
  a: string,
  b: string,
  threshold = 0.6
): boolean {
  return titleSimilarity(a, b) >= threshold;
}
