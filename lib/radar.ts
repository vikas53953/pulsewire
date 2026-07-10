import Parser from "rss-parser";
import { getHistoryDb } from "./history";
import { TRIPWIRES, type TripwireConfig } from "./radar.config";
import { isTestMode } from "./test-mode";
import type { VerdictPayload } from "./types";

export interface RadarTrip {
  id: string;
  name: string;
  domain: TripwireConfig["domain"];
  title: string;
  url: string;
  trippedAt: string;
  blurb?: string;
}

export interface RadarStatus {
  clear: boolean;
  trips: RadarTrip[];
  polledAt: string;
  verdictHint: VerdictPayload | null;
  /** Explains CLEAR vs TRIPPED in plain English */
  summary: string;
}

const globalForRadar = globalThis as unknown as {
  __pulsewireRadarTimer?: ReturnType<typeof setInterval>;
  __pulsewireRadarStatus?: RadarStatus;
  __pulsewireRadarForceTrip?: string | null;
};

const parser = new Parser({
  timeout: 8_000,
  headers: {
    "User-Agent": "PulseWire-Radar/0.1",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

function ensureRadarTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS radar_state (
      tripwire_id TEXT PRIMARY KEY,
      last_seen TEXT NOT NULL,
      last_title TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

function getLastSeen(id: string): string | null {
  ensureRadarTable();
  const row = getHistoryDb()
    .prepare(`SELECT last_seen FROM radar_state WHERE tripwire_id = ?`)
    .get(id) as { last_seen: string } | undefined;
  return row?.last_seen ?? null;
}

function setLastSeen(id: string, seen: string, title: string): void {
  ensureRadarTable();
  getHistoryDb()
    .prepare(
      `INSERT INTO radar_state (tripwire_id, last_seen, last_title, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tripwire_id) DO UPDATE SET
         last_seen = excluded.last_seen,
         last_title = excluded.last_title,
         updated_at = excluded.updated_at`
    )
    .run(id, seen, title, new Date().toISOString());
}

function itemKey(item: {
  guid?: string;
  id?: string;
  link?: string;
  title?: string;
}): string {
  return (item.guid || item.id || item.link || item.title || "").trim();
}

/**
 * Trip only when a *new* RSS item id appears.
 * First successful poll baselines (no trip) so restarts don't false-red.
 */
async function probeTripwire(tw: TripwireConfig): Promise<RadarTrip | null> {
  try {
    const parsed = await parser.parseURL(tw.url);
    const items = (parsed.items || []).filter((i) => {
      if (!i.title) return false;
      if (tw.match && !tw.match.test(i.title)) return false;
      return Boolean(itemKey(i));
    });
    if (items.length === 0) return null;

    const newest = items[0];
    const key = itemKey(newest);
    const prev = getLastSeen(tw.id);

    if (!prev) {
      // Baseline — remember newest, do not trip
      setLastSeen(tw.id, key, newest.title || tw.name);
      return null;
    }
    if (prev === key) return null;

    // New headline since last poll
    setLastSeen(tw.id, key, newest.title || tw.name);
    return {
      id: tw.id,
      name: tw.name,
      domain: tw.domain,
      title: (newest.title || "").trim(),
      url: newest.link || tw.url,
      trippedAt: new Date().toISOString(),
      blurb: tw.blurb,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] radar-probe fail ${tw.id}: ${message}`);
    return null;
  }
}

function buildStatus(trips: RadarTrip[]): RadarStatus {
  const clear = trips.length === 0;
  return {
    clear,
    trips,
    polledAt: new Date().toISOString(),
    verdictHint:
      trips.length > 0
        ? {
            text: `🔴 Radar — ${trips[0].name}: ${trips[0].title}`,
            level: "red",
            llmPolished: false,
          }
        : null,
    summary: clear
      ? "Watching SEBI / Hugging Face / BBC Business. No new items since last check."
      : `New item on ${trips.map((t) => t.name).join(", ")}. This is a tripwire — not a full news feed.`,
  };
}

function fixtureStatus(): RadarStatus {
  const force = globalForRadar.__pulsewireRadarForceTrip;
  if (force) {
    const tw = TRIPWIRES.find((t) => t.id === force) || TRIPWIRES[0];
    const trip: RadarTrip = {
      id: tw.id,
      name: tw.name,
      domain: tw.domain,
      title: `${tw.name}: fixture headline (test trip)`,
      url: tw.url,
      trippedAt: new Date().toISOString(),
      blurb: tw.blurb,
    };
    return buildStatus([trip]);
  }
  return buildStatus([]);
}

export function setRadarForceTripForTests(id: string | null): void {
  globalForRadar.__pulsewireRadarForceTrip = id;
}

export async function pollRadar(): Promise<RadarStatus> {
  if (isTestMode()) {
    const status = fixtureStatus();
    globalForRadar.__pulsewireRadarStatus = status;
    return status;
  }

  const trips: RadarTrip[] = [];
  for (const tw of TRIPWIRES) {
    const trip = await probeTripwire(tw);
    if (trip) trips.push(trip);
  }

  const status = buildStatus(trips);
  globalForRadar.__pulsewireRadarStatus = status;
  if (trips.length > 0) {
    console.info(
      `[pulsewire] radar-trip ${trips.map((t) => t.id).join(",")} (push deferred to M6)`
    );
  }
  return status;
}

export function getRadarStatus(): RadarStatus {
  return (
    globalForRadar.__pulsewireRadarStatus ?? {
      clear: true,
      trips: [],
      polledAt: new Date(0).toISOString(),
      verdictHint: null,
      summary: "Radar not polled yet.",
    }
  );
}

export function startRadarPoller(): void {
  if (globalForRadar.__pulsewireRadarTimer) return;
  if (isTestMode()) {
    void pollRadar();
    return;
  }
  void pollRadar();
  globalForRadar.__pulsewireRadarTimer = setInterval(() => {
    void pollRadar();
  }, 60_000);
  console.info("[pulsewire] radar-poller start interval=60s");
}

/** Wipe baselines (ops / tests). */
export function resetRadarStateForTests(): void {
  ensureRadarTable();
  getHistoryDb().exec(`DELETE FROM radar_state`);
  globalForRadar.__pulsewireRadarStatus = undefined;
  globalForRadar.__pulsewireRadarForceTrip = null;
}
