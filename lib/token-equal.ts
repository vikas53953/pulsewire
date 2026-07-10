/** Constant-time string compare (Edge + Node safe — no node:crypto). */
export function tokensMatch(
  provided: string | null | undefined,
  expected: string
): boolean {
  if (provided == null) return false;
  const a = provided;
  const b = expected;
  const len = Math.max(a.length, b.length);
  // Length mismatch still scans max length so timing doesn't short-circuit early.
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}
