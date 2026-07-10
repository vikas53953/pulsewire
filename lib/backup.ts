/**
 * Snapshot the history DB (baseline moat) via SQLite VACUUM INTO.
 * Run from cron: `npm run backup:db`
 * Optional: set PULSEWIRE_BACKUP_DIR to a second disk / mounted volume.
 */
import fs from "fs";
import path from "path";
import { getHistoryDb, resolveHistoryDbPath } from "./history";

export function defaultBackupDir(): string {
  const override = process.env.PULSEWIRE_BACKUP_DIR?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "backups");
}

export function backupHistoryDb(opts?: {
  dir?: string;
  label?: string;
}): { ok: true; path: string } | { ok: false; error: string } {
  const src = resolveHistoryDbPath();
  if (!fs.existsSync(src)) {
    return { ok: false, error: `no db at ${src}` };
  }

  const dir = opts?.dir ?? defaultBackupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const label = opts?.label ? `-${opts.label}` : "";
  const dest = path.join(dir, `pulsewire${label}-${stamp}.db`);

  try {
    // Checkpoint WAL so the snapshot is consistent, then VACUUM INTO.
    const db = getHistoryDb();
    db.pragma("wal_checkpoint(TRUNCATE)");
    // VACUUM INTO cannot overwrite; dest is unique.
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    console.info(`[pulsewire] backup-ok path=${dest}`);
    return { ok: true, path: dest };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] backup-fail: ${message}`);
    return { ok: false, error: message };
  }
}
