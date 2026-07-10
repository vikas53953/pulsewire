import { getCache } from "./cache";
import { CONTENT_SECTIONS } from "./feeds.config";
import { refreshAll, refreshSection } from "./highlights";

const globalForWarmer = globalThis as unknown as {
  __pulsewireWarmerStarted?: boolean;
  __pulsewireWarmTimer?: ReturnType<typeof setInterval>;
  __pulsewireLastWarmAt?: string;
  __pulsewireLastWarmMs?: number;
  __pulsewireLastWarmReason?: string;
};

export function getWarmerStats(): {
  started: boolean;
  lastWarmAt: string | null;
  lastWarmMs: number | null;
  lastWarmReason: string | null;
} {
  return {
    started: Boolean(globalForWarmer.__pulsewireWarmerStarted),
    lastWarmAt: globalForWarmer.__pulsewireLastWarmAt ?? null,
    lastWarmMs: globalForWarmer.__pulsewireLastWarmMs ?? null,
    lastWarmReason: globalForWarmer.__pulsewireLastWarmReason ?? null,
  };
}

function ttlMs(): number {
  const minutes = Number(process.env.CACHE_TTL_MINUTES ?? "10");
  return Math.max(1, minutes) * 60_000;
}

/**
 * Warm every section (+ all) so tab clicks hit a hot cache.
 * Runs once on first import and every CACHE_TTL_MINUTES thereafter.
 */
export async function warmAllSections(reason: string): Promise<void> {
  console.info(`[pulsewire] warm-start reason=${reason}`);
  const started = Date.now();
  try {
    // refreshAll already builds every content section + all
    await refreshAll();
    for (const section of CONTENT_SECTIONS) {
      const cached = getCache(section);
      console.info(
        `[pulsewire] warm-ok section=${section} items=${cached.entry?.items.length ?? 0}`
      );
    }
    // M7: Reddit plane warm only — never x_search (M8 governor earns X).
    try {
      const { getRedditSignals } = await import("./reddit-plane");
      const signals = await getRedditSignals({ forceRefresh: true });
      console.info(`[pulsewire] warm-ok reddit-plane signals=${signals.length}`);
    } catch (redditErr) {
      const message =
        redditErr instanceof Error ? redditErr.message : String(redditErr);
      console.warn(`[pulsewire] warm-fail reddit-plane: ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] warm-fail: ${message}`);
  }
  const ms = Date.now() - started;
  globalForWarmer.__pulsewireLastWarmAt = new Date().toISOString();
  globalForWarmer.__pulsewireLastWarmMs = ms;
  globalForWarmer.__pulsewireLastWarmReason = reason;
  console.info(`[pulsewire] warm-done ms=${ms}`);
}

export function startBackgroundWarmer(): void {
  if (globalForWarmer.__pulsewireWarmerStarted) return;
  globalForWarmer.__pulsewireWarmerStarted = true;

  // Kick off immediately (don't block import)
  void warmAllSections("boot");

  // In PW_TEST, warm once on boot only — interval re-warms would overwrite
  // short RAW_CACHE_TTL_MS and break TTL assertions.
  if (process.env.PW_TEST === "1") {
    console.info("[pulsewire] warmer: PW_TEST=1 — boot warm only, no interval");
    return;
  }

  globalForWarmer.__pulsewireWarmTimer = setInterval(() => {
    void warmAllSections("interval");
  }, ttlMs());

  // Don't keep the process alive solely for the timer in some runtimes
  if (
    globalForWarmer.__pulsewireWarmTimer &&
    typeof globalForWarmer.__pulsewireWarmTimer === "object" &&
    "unref" in globalForWarmer.__pulsewireWarmTimer
  ) {
    (
      globalForWarmer.__pulsewireWarmTimer as NodeJS.Timeout
    ).unref?.();
  }
}

// Also export a single-section warm for targeted refresh
export async function warmSection(
  section: (typeof CONTENT_SECTIONS)[number]
): Promise<void> {
  await refreshSection(section);
}
