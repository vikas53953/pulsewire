import fs from "fs";
import {
  flushDbNow,
  getSqlDb,
  initSqlJsModuleForTests,
  reopenSqlDb,
  resolveSnapshotPath,
  type SqlDatabase,
} from "./sqldb";
import type { ContentSectionId } from "./types";

export interface HistorySample {
  section: ContentSectionId;
  timestamp: string;
  sectionRaw: number;
  clusterCount: number;
  topBreadth: number;
  /** IST hour 0–23 */
  hourIst: number;
  /** IST weekday 0=Sun … 6=Sat */
  weekdayIst: number;
}

const schemaReady = new WeakSet<SqlDatabase>();

export function resolveHistoryDbPath(): string {
  return resolveSnapshotPath();
}

export function getHistoryDb(): SqlDatabase {
  const db = getSqlDb();
  if (schemaReady.has(db)) return db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS section_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      section_raw REAL NOT NULL,
      cluster_count INTEGER NOT NULL,
      top_breadth INTEGER NOT NULL,
      hour_ist INTEGER NOT NULL,
      weekday_ist INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_bucket
      ON section_history (section, weekday_ist, hour_ist, timestamp);
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 1);
  `);
  schemaReady.add(db);
  return db;
}

/** Asia/Kolkata parts for baseline buckets. */
export function istBucketParts(at = new Date()): {
  hourIst: number;
  weekdayIst: number;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(at);
  const hourRaw = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  // en-GB hour12:false can yield "24" for midnight in some engines
  const hourIst = hourRaw === 24 ? 0 : hourRaw;
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hourIst, weekdayIst: map[wd] ?? 0 };
}

/**
 * Persist one section sample. Call on every warm/refresh cycle.
 * This starts the 60-day moat clock — ship early, use late.
 */
export function writeHistorySample(input: {
  section: ContentSectionId;
  sectionRaw: number;
  clusterCount: number;
  topBreadth: number;
  at?: Date;
}): void {
  try {
    const at = input.at ?? new Date();
    const { hourIst, weekdayIst } = istBucketParts(at);
    const db = getHistoryDb();
    db.prepare(
      `INSERT INTO section_history
        (section, timestamp, section_raw, cluster_count, top_breadth, hour_ist, weekday_ist)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.section,
      at.toISOString(),
      input.sectionRaw,
      input.clusterCount,
      input.topBreadth,
      hourIst,
      weekdayIst
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] history-write fail section=${input.section}: ${message}`);
  }
}

export function countHistorySamples(section?: ContentSectionId): number {
  const db = getHistoryDb();
  if (section) {
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM section_history WHERE section = ?`)
      .get(section) as { n: number };
    return row.n;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM section_history`)
    .get() as { n: number };
  return row.n;
}

/** Trailing samples for a section × IST hour × weekday (up to 60 days). */
export function readBucketSamples(
  section: ContentSectionId,
  hourIst: number,
  weekdayIst: number,
  now = Date.now(),
  trailDays = 60
): number[] {
  return readBucketSampleRows(section, hourIst, weekdayIst, now, trailDays).map(
    (r) => r.sectionRaw,
  );
}

/** Same bucket as readBucketSamples, with timestamps for streak math. */
export function readBucketSampleRows(
  section: ContentSectionId,
  hourIst: number,
  weekdayIst: number,
  now = Date.now(),
  trailDays = 60,
): Array<{ sectionRaw: number; timestamp: string }> {
  const db = getHistoryDb();
  const since = new Date(now - trailDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT section_raw, timestamp FROM section_history
       WHERE section = ? AND hour_ist = ? AND weekday_ist = ?
         AND timestamp >= ?
       ORDER BY timestamp ASC`,
    )
    .all(section, hourIst, weekdayIst, since) as {
    section_raw: number;
    timestamp: string;
  }[];
  return rows.map((r) => ({
    sectionRaw: r.section_raw,
    timestamp: r.timestamp,
  }));
}

/** Test helper: wipe + optional seed. */
export function resetHistoryForTests(): void {
  const db = getHistoryDb();
  db.exec(`DELETE FROM section_history`);
}

export function seedHistoryForTests(samples: HistorySample[]): void {
  const db = getHistoryDb();
  const stmt = db.prepare(
    `INSERT INTO section_history
      (section, timestamp, section_raw, cluster_count, top_breadth, hour_ist, weekday_ist)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows: HistorySample[]) => {
    for (const s of rows) {
      stmt.run(
        s.section,
        s.timestamp,
        s.sectionRaw,
        s.clusterCount,
        s.topBreadth,
        s.hourIst,
        s.weekdayIst
      );
    }
  });
  tx(samples);
}

export async function closeHistoryDbForTests(): Promise<void> {
  await reopenSqlDb();
}

/**
 * Persistence proof for M5 gate: flush snapshot → open the on-disk image in a
 * fresh sql.js instance → count rows. Never touches the live singleton.
 */
export async function assertHistoryPersistsForTests(): Promise<{
  path: string;
  countBefore: number;
  countAfter: number;
  exists: boolean;
}> {
  const before = countHistorySamples();
  const resolved = resolveHistoryDbPath();
  await flushDbNow();
  const SQL = await initSqlJsModuleForTests();
  const image = fs.readFileSync(resolved);
  const fresh = new SQL.Database(new Uint8Array(image));
  try {
    const res = fresh.exec(`SELECT COUNT(*) AS n FROM section_history`);
    const countAfter = Number(res[0]?.values?.[0]?.[0] ?? 0);
    return {
      path: resolved,
      countBefore: before,
      countAfter,
      exists: fs.existsSync(resolved),
    };
  } finally {
    fresh.close();
  }
}
