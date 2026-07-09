import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
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

const globalForDb = globalThis as unknown as {
  __pulsewireDb?: Database.Database;
  __pulsewireDbPath?: string;
};

export function resolveHistoryDbPath(): string {
  // Bracket access — Next webpack can inline process.env.FOO as undefined at compile time.
  const override = process.env["PULSEWIRE_DB_PATH"];
  if (override && override.trim()) return override.trim();
  // Prefer project-local data/ so restarts keep history
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // fall through
    }
  }
  return path.join(dir, "pulsewire.db");
}

function dbPath(): string {
  return resolveHistoryDbPath();
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getHistoryDb(): Database.Database {
  const resolved = dbPath();
  if (globalForDb.__pulsewireDb && globalForDb.__pulsewireDbPath === resolved) {
    return globalForDb.__pulsewireDb;
  }

  // Stale WAL from a prior journal mode can make the DB appear readonly.
  if (globalForDb.__pulsewireDb) {
    try {
      globalForDb.__pulsewireDb.close();
    } catch {
      // ignore
    }
    globalForDb.__pulsewireDb = undefined;
    globalForDb.__pulsewireDbPath = undefined;
  }

  ensureParentDir(resolved);
  // Drop leftover WAL/SHM from prior runs so journal_mode can switch cleanly.
  for (const suffix of ["-wal", "-shm"]) {
    try {
      fs.unlinkSync(resolved + suffix);
    } catch {
      // ignore
    }
  }
  const db = new Database(resolved);
  // DELETE journal: single file on disk — restart/reopen asserts stay simple under Next.
  db.pragma("journal_mode = DELETE");
  db.pragma("busy_timeout = 5000");
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
  `);

  globalForDb.__pulsewireDb = db;
  globalForDb.__pulsewireDbPath = resolved;
  console.info(`[pulsewire] history-db open path=${resolved}`);
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
  const db = getHistoryDb();
  const since = new Date(now - trailDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT section_raw FROM section_history
       WHERE section = ? AND hour_ist = ? AND weekday_ist = ?
         AND timestamp >= ?
       ORDER BY timestamp ASC`
    )
    .all(section, hourIst, weekdayIst, since) as { section_raw: number }[];
  return rows.map((r) => r.section_raw);
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

export function closeHistoryDbForTests(): void {
  if (globalForDb.__pulsewireDb) {
    try {
      globalForDb.__pulsewireDb.close();
    } catch {
      // ignore
    }
    globalForDb.__pulsewireDb = undefined;
    globalForDb.__pulsewireDbPath = undefined;
  }
}
