#!/usr/bin/env node
/**
 * Nightly / pre-deploy snapshot of data/pulsewire.db (baseline moat).
 *
 * Cron example:
 *   15 2 * * * cd /path/to/pulsewire && npm run backup:db >> /var/log/pulsewire-backup.log 2>&1
 *
 * Keeps the newest 14 snapshots (PULSEWIRE_BACKUP_KEEP); deletes older.
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const fs = require("fs");

const KEEP = Math.max(1, Number(process.env.PULSEWIRE_BACKUP_KEEP ?? "14") || 14);

const src =
  process.env.PULSEWIRE_DB_PATH?.trim() ||
  path.join(root, "data", "pulsewire.db");
const backupDir =
  process.env.PULSEWIRE_BACKUP_DIR?.trim() ||
  path.join(root, "data", "backups");

/** @param {string} dir @param {number} keep */
function pruneBackups(dir, keep = KEEP) {
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

if (!fs.existsSync(src)) {
  console.error(`[pulsewire] backup-fail: no db at ${src}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(backupDir, `pulsewire-${stamp}.db`);

// The live DB persists itself as a standard SQLite image — backup = copy.
try {
  fs.copyFileSync(src, dest);
  console.info(`[pulsewire] backup-ok path=${dest}`);
} catch (e) {
  console.error(`[pulsewire] backup-fail: ${e.message || e}`);
  process.exit(1);
}

const pruned = pruneBackups(backupDir, KEEP);
console.info(
  `[pulsewire] backup-prune kept=${pruned.kept} deleted=${pruned.deleted} keep=${KEEP}`
);
