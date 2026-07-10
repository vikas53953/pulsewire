import Parser from "rss-parser";
import { getHistoryDb } from "./history";
import {
  detectNewRssItems,
  isActionableRadarHeadline,
  radarVerdictFromTrips,
  type RadarListItem,
} from "./radar-detect";
import { TRIPWIRES, type TripwireConfig } from "./radar.config";
import { isTestMode } from "./test-mode";
import type { VerdictPayload } from "./types";

export type { RadarListItem };
export {
  detectNewRssItems,
  isActionableRadarHeadline,
  radarVerdictFromTrips,
} from "./radar-detect";

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
    "User-Agent":
      "PulseWire-Radar/0.3 (+https://github.com/vikas53953/pulsewire)",
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

/** Stored as JSON array of item ids (listing snapshot), never a page hash. */
function getSeenIds(id: string): string[] | null {
  ensureRadarTable();
  const row = getHistoryDb()
    .prepare(`SELECT last_seen FROM radar_state WHERE tripwire_id = ?`)
    .get(id) as { last_seen: string } | undefined;
  if (!row?.last_seen) return null;
  try {
    const parsed = JSON.parse(row.last_seen) as unknown;
    if (Array.isArray(parsed)) {
      const ids = parsed.map(String).filter(Boolean);
      // Empty snapshot → re-baseline (never treat as "everything is new").
      return ids.length > 0 ? ids : null;
    }
  } catch {
    // Legacy single-key baseline from pre-V2 — re-baseline, do not storm.
    console.info(
      `[pulsewire] radar migrate legacy baseline ${id} → re-baseline`,
    );
    return null;
  }
  return null;
}

function setSeenIds(id: string, ids: string[], title: string): void {
  ensureRadarTable();
  getHistoryDb()
    .prepare(
      `INSERT INTO radar_state (tripwire_id, last_seen, last_title, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tripwire_id) DO UPDATE SET
         last_seen = excluded.last_seen,
         last_title = excluded.last_title,
         updated_at = excluded.updated_at`,
    )
    .run(id, JSON.stringify(ids), title, new Date().toISOString());
}

function toListItems(
  items: Parser.Item[],
  match?: RegExp,
): RadarListItem[] {
  return items
    .map((i) => {
      const extra = i as Parser.Item & { id?: string };
      const id = String(extra.guid || extra.id || extra.link || extra.title || "").trim();
      const title = String(i.title || "").trim();
      const link = String(i.link || "").trim();
      return { id, title, link };
    })
    .filter((i) => {
      if (!i.id) return false;
      if (match && i.title && !match.test(i.title)) return false;
      return true;
    });
}

/**
 * Trip only when a *new* listing item id appears with an extractable title.
 * Timestamps/counters/ads changing with the same items → no trip.
 * First successful poll baselines (no trip).
 */
async function probeTripwire(tw: TripwireConfig): Promise<RadarTrip[]> {
  try {
    const parsed = await parser.parseURL(tw.url);
    const items = toListItems(parsed.items || [], tw.match);
    if (items.length === 0) return [];

    const prevIds = getSeenIds(tw.id);
    const nextIds = items.map((i) => i.id);

    if (!prevIds || prevIds.length === 0) {
      setSeenIds(tw.id, nextIds, items[0]?.title || tw.name);
      console.info(
        `[pulsewire] radar baseline ${tw.id} items=${items.length}`,
      );
      return [];
    }

    const previous: RadarListItem[] = prevIds.map((id) => ({
      id,
      title: "",
      link: "",
    }));
    const { newItems, skippedUntitled } = detectNewRssItems(previous, items);

    for (const s of skippedUntitled) {
      console.warn(
        `[pulsewire] radar skip untitled new item ${tw.id} id=${s.id}`,
      );
    }

    const trips: RadarTrip[] = [];
    for (const item of newItems) {
      if (!isActionableRadarHeadline(item.title, tw.name)) {
        console.warn(
          `[pulsewire] radar skip non-actionable title ${tw.id}: ${item.title}`,
        );
        continue;
      }
      trips.push({
        id: tw.id,
        name: tw.name,
        domain: tw.domain,
        title: item.title,
        url: item.link || tw.url,
        trippedAt: new Date().toISOString(),
        blurb: tw.blurb,
      });
      console.info(
        `[pulsewire] radar TRIP ${tw.id}: ${item.title.slice(0, 80)}`,
      );
    }

    setSeenIds(tw.id, nextIds, items[0]?.title || tw.name);
    return trips;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] radar-probe fail ${tw.id}: ${message}`);
    return [];
  }
}

function buildStatus(trips: RadarTrip[]): RadarStatus {
  const actionable = trips.filter((t) =>
    isActionableRadarHeadline(t.title, t.name),
  );
  const clear = actionable.length === 0;
  return {
    clear,
    trips: actionable,
    polledAt: new Date().toISOString(),
    verdictHint: radarVerdictFromTrips(actionable),
    summary: clear
      ? "Watching SEBI / Hugging Face / BBC Business. No new items since last check."
      : `New item on ${actionable.map((t) => t.name).join(", ")}. This is a tripwire — not a full news feed.`,
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
    const found = await probeTripwire(tw);
    trips.push(...found);
  }

  const status = buildStatus(trips);
  globalForRadar.__pulsewireRadarStatus = status;
  if (!status.clear) {
    console.info(
      `[pulsewire] radar-trip ${status.trips.map((t) => t.id).join(",")} (push deferred to M6)`,
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

/**
 * Test helper: run pure list-diff against an in-memory previous snapshot
 * (Playwright / unit — no network).
 */
export function evaluateListingDiffForTests(
  sourceName: string,
  previous: RadarListItem[],
  current: RadarListItem[],
): { trips: RadarListItem[]; verdict: VerdictPayload | null } {
  const { newItems, skippedUntitled } = detectNewRssItems(previous, current);
  for (const s of skippedUntitled) {
    console.warn(`[pulsewire] radar skip untitled (test) id=${s.id}`);
  }
  const trips = newItems.filter((i) =>
    isActionableRadarHeadline(i.title, sourceName),
  );
  return {
    trips,
    verdict: radarVerdictFromTrips(
      trips.map((t) => ({ name: sourceName, title: t.title })),
    ),
  };
}
