/**
 * Beta usage accounting — anonymous device ID + SQLite, no PII.
 * Success metric: ≥40% open ≥4 mornings/week; median session <60s.
 */

import { getHistoryDb } from "./history";

export type UsageRow = {
  deviceId: string;
  day: string;
  opens: number;
  totalSessionMs: number;
  lastSeen: string;
};

export type UsageStats = {
  devicesToday: number;
  opensToday: number;
  medianSessionMs7d: number | null;
};

/** UTC calendar day YYYY-MM-DD */
export function usageDayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function ensureUsageTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      device_id TEXT NOT NULL,
      day TEXT NOT NULL,
      opens INTEGER NOT NULL DEFAULT 0,
      total_session_ms INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL,
      PRIMARY KEY (device_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_day ON usage (day);
  `);

  const row = db
    .prepare(`SELECT version FROM schema_version WHERE id = 1`)
    .get() as { version: number } | undefined;
  const version = row?.version ?? 1;
  if (version < 2) {
    db.prepare(`UPDATE schema_version SET version = 2 WHERE id = 1`).run();
  }
}

function sanitizeDeviceId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().slice(0, 64);
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return null;
  return id;
}

/** Record one open for today (call once per browser session). */
export function recordOpen(deviceIdRaw: string, at = new Date()): boolean {
  const deviceId = sanitizeDeviceId(deviceIdRaw);
  if (!deviceId) return false;
  ensureUsageTable();
  const day = usageDayKey(at);
  const now = at.toISOString();
  getHistoryDb()
    .prepare(
      `INSERT INTO usage (device_id, day, opens, total_session_ms, last_seen)
       VALUES (?, ?, 1, 0, ?)
       ON CONFLICT(device_id, day) DO UPDATE SET
         opens = opens + 1,
         last_seen = excluded.last_seen`
    )
    .run(deviceId, day, now);
  return true;
}

/** Add session duration (ms) for today. */
export function recordSession(
  deviceIdRaw: string,
  sessionMs: number,
  at = new Date()
): boolean {
  const deviceId = sanitizeDeviceId(deviceIdRaw);
  if (!deviceId) return false;
  const ms = Math.max(0, Math.min(Math.floor(sessionMs), 24 * 60 * 60_000));
  if (!Number.isFinite(ms)) return false;
  ensureUsageTable();
  const day = usageDayKey(at);
  const now = at.toISOString();
  getHistoryDb()
    .prepare(
      `INSERT INTO usage (device_id, day, opens, total_session_ms, last_seen)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(device_id, day) DO UPDATE SET
         total_session_ms = total_session_ms + excluded.total_session_ms,
         last_seen = excluded.last_seen`
    )
    .run(deviceId, day, ms, now);
  return true;
}

/** Median of positive numbers; null if empty. Pure — unit-tested. */
export function medianMs(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 0) {
    return Math.round((xs[mid - 1] + xs[mid]) / 2);
  }
  return Math.round(xs[mid]);
}

/**
 * Per-row average session ≈ total_session_ms / max(opens, 1) when opens>0
 * and sessions were recorded; otherwise use total when opens==0 but ms>0.
 */
export function rowSessionSamples(rows: Array<{ opens: number; totalSessionMs: number }>): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (r.totalSessionMs <= 0) continue;
    if (r.opens > 0) {
      // One sample per open (average length that day for that device)
      out.push(Math.round(r.totalSessionMs / r.opens));
    } else {
      out.push(r.totalSessionMs);
    }
  }
  return out;
}

export function getUsageStats(at = new Date()): UsageStats {
  ensureUsageTable();
  const db = getHistoryDb();
  const today = usageDayKey(at);
  const dayRow = db
    .prepare(
      `SELECT
         COUNT(DISTINCT device_id) AS devices,
         COALESCE(SUM(opens), 0) AS opens
       FROM usage WHERE day = ?`
    )
    .get(today) as { devices: number; opens: number };

  const since = new Date(at.getTime() - 7 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  const weekRows = db
    .prepare(
      `SELECT opens, total_session_ms AS totalSessionMs
       FROM usage WHERE day >= ? AND total_session_ms > 0`
    )
    .all(since) as Array<{ opens: number; totalSessionMs: number }>;

  return {
    devicesToday: dayRow.devices ?? 0,
    opensToday: dayRow.opens ?? 0,
    medianSessionMs7d: medianMs(rowSessionSamples(weekRows)),
  };
}
