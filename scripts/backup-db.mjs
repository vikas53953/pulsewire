#!/usr/bin/env node
/**
 * Nightly / pre-deploy snapshot of data/pulsewire.db (baseline moat).
 *
 * Cron example (host with the running instance's data volume):
 *   15 2 * * * cd /path/to/pulsewire && npm run backup:db >> /var/log/pulsewire-backup.log 2>&1
 *
 * Pre-deploy:
 *   npm run backup:db
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Prefer compiled/ts via next's path — use better-sqlite3 directly for a tiny standalone.
const Database = require("better-sqlite3");
const fs = require("fs");

const src =
  process.env.PULSEWIRE_DB_PATH?.trim() ||
  path.join(root, "data", "pulsewire.db");
const backupDir =
  process.env.PULSEWIRE_BACKUP_DIR?.trim() ||
  path.join(root, "data", "backups");

if (!fs.existsSync(src)) {
  console.error(`[pulsewire] backup-fail: no db at ${src}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(backupDir, `pulsewire-${stamp}.db`);

const db = new Database(src);
try {
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  console.info(`[pulsewire] backup-ok path=${dest}`);
} catch (e) {
  console.error(`[pulsewire] backup-fail: ${e.message || e}`);
  process.exit(1);
} finally {
  db.close();
}
