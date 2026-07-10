import { CALIBRATING_MIN_SAMPLES, median } from "./baseline";
import { getHistoryDb, istBucketParts } from "./history";
import { isTestMode } from "./test-mode";

/** schema_version 3 — per-subreddit velocity history (additive). */
export function ensureSocialVelocityTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_velocity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subreddit TEXT NOT NULL,
      plane TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      velocity REAL NOT NULL,
      hour_ist INTEGER NOT NULL,
      weekday_ist INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_social_vel_bucket
      ON social_velocity_history (subreddit, weekday_ist, hour_ist, timestamp);
  `);
  const row = db
    .prepare(`SELECT version FROM schema_version WHERE id = 1`)
    .get() as { version: number } | undefined;
  const version = row?.version ?? 1;
  if (version < 3) {
    db.prepare(`UPDATE schema_version SET version = 3 WHERE id = 1`).run();
  }
}

export function writeSocialVelocitySample(input: {
  subreddit: string;
  plane: "reddit" | "x";
  velocity: number;
  at?: Date;
}): void {
  if (isTestMode() && process.env.PW_HISTORY !== "1") return;
  if (!Number.isFinite(input.velocity) || input.velocity <= 0) return;
  const sub = input.subreddit.replace(/^r\//i, "").trim();
  if (!sub) return;
  ensureSocialVelocityTable();
  const at = input.at ?? new Date();
  const { hourIst, weekdayIst } = istBucketParts(at);
  getHistoryDb()
    .prepare(
      `INSERT INTO social_velocity_history
        (subreddit, plane, timestamp, velocity, hour_ist, weekday_ist)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sub.toLowerCase(),
      input.plane,
      at.toISOString(),
      input.velocity,
      hourIst,
      weekdayIst,
    );
}

export function readSocialVelocitySamples(
  subreddit: string,
  hourIst: number,
  weekdayIst: number,
  now = Date.now(),
  trailDays = 60,
): number[] {
  ensureSocialVelocityTable();
  const sub = subreddit.replace(/^r\//i, "").trim().toLowerCase();
  const since = new Date(now - trailDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = getHistoryDb()
    .prepare(
      `SELECT velocity FROM social_velocity_history
       WHERE subreddit = ? AND hour_ist = ? AND weekday_ist = ?
         AND timestamp >= ?
       ORDER BY timestamp ASC`,
    )
    .all(sub, hourIst, weekdayIst, since) as { velocity: number }[];
  return rows.map((r) => r.velocity);
}

/** Ratio of current velocity to bucket median — null when calibrating. */
export function velocityRatio(
  velocity: number,
  samples: number[],
  minSamples = CALIBRATING_MIN_SAMPLES,
): number | null {
  if (samples.length < minSamples) return null;
  const med = median(samples);
  if (med <= 0) return null;
  return Math.round((velocity / med) * 10) / 10;
}

export function formatVelocityWhy(
  velocity: number,
  source: string,
  ratio: number | null,
): string {
  const velBit = Number.isInteger(velocity)
    ? String(velocity)
    : velocity.toFixed(1);
  if (ratio != null && ratio >= 1.5) {
    const sub = source.startsWith("r/") ? source : `r/${source.replace(/^r\//i, "")}`;
    return `vel ${velBit} — ${ratio}× normal for ${sub}`;
  }
  return `vel ${velBit}`;
}

/** Accent from ratio when baselined; else raw velocity thresholds. */
export function trendAccentFromVelocity(
  velocity: number | undefined,
  ratio: number | null,
): "hot" | "warm" | "none" {
  if (ratio != null) {
    if (ratio >= 3) return "hot";
    if (ratio >= 1.5) return "warm";
    return "none";
  }
  const v = velocity ?? 0;
  if (v >= 8) return "hot";
  if (v >= 4) return "warm";
  return "none";
}
