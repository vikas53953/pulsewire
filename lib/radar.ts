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
}

export interface RadarStatus {
  clear: boolean;
  trips: RadarTrip[];
  polledAt: string;
  verdictHint: VerdictPayload | null;
}

const globalForRadar = globalThis as unknown as {
  __pulsewireRadarTimer?: ReturnType<typeof setInterval>;
  __pulsewireRadarStatus?: RadarStatus;
  __pulsewireRadarForceTrip?: string | null;
};

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

async function probeTripwire(tw: TripwireConfig): Promise<RadarTrip | null> {
  try {
    const res = await fetch(tw.url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "PulseWire-Radar/0.1" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Content fingerprint — new body vs last_seen trips once
    const fingerprint = `${res.status}:${text.length}:${text.slice(0, 200)}`;
    const prev = getLastSeen(tw.id);
    if (!prev) {
      setLastSeen(tw.id, fingerprint, tw.name);
      return null;
    }
    if (prev === fingerprint) return null;
    setLastSeen(tw.id, fingerprint, tw.name);
    return {
      id: tw.id,
      name: tw.name,
      domain: tw.domain,
      title: `${tw.name} changed`,
      url: tw.url,
      trippedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function fixtureStatus(): RadarStatus {
  const force = globalForRadar.__pulsewireRadarForceTrip;
  if (force) {
    const tw = TRIPWIRES.find((t) => t.id === force) || TRIPWIRES[0];
    const trip: RadarTrip = {
      id: tw.id,
      name: tw.name,
      domain: tw.domain,
      title: `${tw.name} tripwire fired (fixture)`,
      url: tw.url,
      trippedAt: new Date().toISOString(),
    };
    return {
      clear: false,
      trips: [trip],
      polledAt: new Date().toISOString(),
      verdictHint: {
        text: `🔴 Radar — ${tw.name}: ${trip.title}`,
        level: "red",
        llmPolished: false,
      },
    };
  }
  return {
    clear: true,
    trips: [],
    polledAt: new Date().toISOString(),
    verdictHint: null,
  };
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

  const status: RadarStatus = {
    clear: trips.length === 0,
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
  };
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
    }
  );
}

export function startRadarPoller(): void {
  if (globalForRadar.__pulsewireRadarTimer) return;
  if (isTestMode()) {
    // Boot once for fixtures; no 60s interval under PW_TEST
    void pollRadar();
    return;
  }
  void pollRadar();
  globalForRadar.__pulsewireRadarTimer = setInterval(() => {
    void pollRadar();
  }, 60_000);
  console.info("[pulsewire] radar-poller start interval=60s");
}
