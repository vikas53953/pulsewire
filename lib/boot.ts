/**
 * Process boot clock — used to suppress false velocity spikes when every
 * existing source "appears" at once on cold start / deploy.
 */
const globalForBoot = globalThis as unknown as {
  __pulsewireBootAt?: number;
};

export function processBootAt(): number {
  if (!globalForBoot.__pulsewireBootAt) {
    globalForBoot.__pulsewireBootAt = Date.now();
  }
  return globalForBoot.__pulsewireBootAt;
}

/** Sources observed within this window of boot are treated as pre-existing. */
export const BOOT_VELOCITY_GRACE_MS = 5 * 60_000;

/**
 * True when every firstSeen falls inside the boot grace window —
 * classic cold-start / deploy trap (all sources "arrive" together).
 */
export function isBootWindowCluster(
  firstSeens: string[],
  bootAt = processBootAt(),
  graceMs = BOOT_VELOCITY_GRACE_MS
): boolean {
  if (firstSeens.length === 0) return false;
  const times = firstSeens
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t));
  if (times.length === 0) return false;
  return times.every((t) => t >= bootAt && t <= bootAt + graceMs);
}

/** Test-only: pin boot clock. */
export function setProcessBootAtForTests(ms: number): void {
  globalForBoot.__pulsewireBootAt = ms;
}
