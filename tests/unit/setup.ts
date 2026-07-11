import fs from "fs";
import os from "os";
import path from "path";
import { initSqlDb } from "@/lib/sqldb";

// Isolated throwaway snapshot per vitest run — unit tests must never touch
// the real data/pulsewire.db.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-vitest-"));
process.env.PULSEWIRE_DB_PATH = path.join(dir, "pulsewire.db");

await initSqlDb();
