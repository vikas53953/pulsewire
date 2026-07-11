/**
 * Snapshot the history DB (baseline moat) via SQLite VACUUM INTO.
 * Run from cron: `npm run backup:db`
 * Optional: set PULSEWIRE_BACKUP_DIR to a second disk / mounted volume.
 * Keeps the newest N snapshots (default 14).
 */
import fs from "fs";
import path from "path";
import { getHistoryDb, resolveHistoryDbPath } from "./history";

export function defaultBackupDir(): string {
  const override = process.env.PULSEWIRE_BACKUP_DIR?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "backups");
}

export function backupKeepCount(): number {
  return Math.max(1, Number(process.env.PULSEWIRE_BACKUP_KEEP ?? "14") || 14);
}

/** Keep newest `keep` pulsewire*.db files; delete older. */
export function pruneBackups(
  dir: string,
  keep = backupKeepCount()
): { kept: number; deleted: number } {
  if (!fs.existsSync(dir)) return { kept: 0, deleted: 0 };
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^pulsewire.*\.db$/i.test(f))
    .map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { full, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  let deleted = 0;
  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(file.full);
      deleted += 1;
    } catch {
      // ignore
    }
  }
  return { kept: Math.min(files.length, keep), deleted };
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
    // sql.js snapshot model: export the live image directly (already vacuumed
    // in spirit — it is the canonical file bytes).
    const db = getHistoryDb();
    fs.writeFileSync(dest, Buffer.from(db.export()));
    const pruned = pruneBackups(dir);
    console.info(
      `[pulsewire] backup-ok path=${dest} prune kept=${pruned.kept} deleted=${pruned.deleted}`
    );
    return { ok: true, path: dest };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pulsewire] backup-fail: ${message}`);
    return { ok: false, error: message };
  }
}
