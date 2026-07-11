/**
 * Synchronous SQLite for every runtime, without native builds.
 *
 * sql.js (SQLite compiled to WASM) keeps the better-sqlite3-style sync API the
 * scoring hot path depends on (score.ts → history.ts is sync), while removing
 * the node-gyp native dependency and making serverless possible:
 *
 *   - Local / self-hosted: snapshot persisted to data/pulsewire.db (same file
 *     format as before — existing data loads unchanged).
 *   - Vercel: snapshot loaded from Vercel Blob on cold start, flushed back on
 *     a debounce; critical writers await flushDbNow().
 *
 * WASM init is async exactly once: instrumentation.ts awaits initSqlDb() at
 * boot (Next awaits register() on every cold start). Vitest awaits it in a
 * setup file; standalone scripts await it explicitly.
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";

type Row = Record<string, unknown>;
type BindValue = number | string | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SqlStatement {
  get(...params: BindValue[]): Row | undefined;
  all(...params: BindValue[]): Row[];
  run(...params: BindValue[]): RunResult;
}

export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
  pragma(directive: string): unknown;
  transaction<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void;
  close(): void;
  /** Raw snapshot bytes (standard SQLite file image). */
  export(): Uint8Array;
}

const globalForSql = globalThis as unknown as {
  __pwSqlModule?: Awaited<ReturnType<typeof initSqlJs>>;
  __pwSqlDb?: AdapterDb;
  __pwSqlDbKey?: string;
  __pwSqlDirty?: boolean;
  __pwSqlFlushTimer?: ReturnType<typeof setTimeout> | null;
  __pwSqlFlushing?: Promise<void> | null;
  /** Exporting mid-transaction aborts sql.js COMMIT — defer flushes. */
  __pwSqlInTxn?: boolean;
};

function isVercel(): boolean {
  return Boolean(process.env["VERCEL"]);
}

function isTestLike(): boolean {
  return (
    process.env["PW_TEST"] === "1" ||
    process.env["NODE_ENV"] === "test" ||
    Boolean(process.env["VITEST"])
  );
}

export function resolveSnapshotPath(): string {
  const override = process.env["PULSEWIRE_DB_PATH"];
  if (override && override.trim()) return override.trim();
  const dir = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // fall through — open will fail loudly if truly unwritable
  }
  return path.join(dir, "pulsewire.db");
}

/* ------------------------------ Blob driver ------------------------------ */
// Uses @vercel/blob, which authenticates via BLOB_READ_WRITE_TOKEN (classic
// stores) or BLOB_STORE_ID + Vercel OIDC (new private stores) automatically.

type BlobAccess = "private" | "public";

function blobConfigured(): boolean {
  return Boolean(
    (process.env["BLOB_READ_WRITE_TOKEN"] ?? "").trim() ||
      (process.env["BLOB_STORE_ID"] ?? "").trim(),
  );
}

/** Unguessable pathname — public-store fallback exposes blob URLs. */
function blobPathname(): string {
  const seed = (
    (process.env["BLOB_READ_WRITE_TOKEN"] ?? "") +
    (process.env["BLOB_STORE_ID"] ?? "")
  ).trim();
  const secret = createHash("sha256").update(seed).digest("hex").slice(0, 20);
  return `pw/${secret}/pulsewire.db`;
}

const globalForBlobAccess = globalThis as unknown as {
  __pwBlobAccess?: BlobAccess;
};

function accessOrder(): BlobAccess[] {
  const known = globalForBlobAccess.__pwBlobAccess;
  if (known) return [known];
  return ["private", "public"];
}

async function blobLoad(): Promise<Uint8Array | null> {
  if (!blobConfigured()) {
    console.warn(
      "[pulsewire] blob store not configured — snapshot persistence disabled",
    );
    return null;
  }
  const { get } = await import("@vercel/blob");
  for (const access of accessOrder()) {
    try {
      const res = await get(blobPathname(), { access, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) continue;
      const buf = await new Response(res.stream).arrayBuffer();
      globalForBlobAccess.__pwBlobAccess = access;
      return new Uint8Array(buf);
    } catch {
      // wrong access mode for this store — try the other
    }
  }
  return null;
}

async function blobSave(bytes: Uint8Array): Promise<void> {
  if (!blobConfigured()) return;
  const { put } = await import("@vercel/blob");
  let lastError: unknown = null;
  for (const access of accessOrder()) {
    try {
      await put(blobPathname(), Buffer.from(bytes), {
        access: access as "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
      globalForBlobAccess.__pwBlobAccess = access;
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/* ------------------------------ File driver ------------------------------ */

function fileLoad(): Uint8Array | null {
  const p = resolveSnapshotPath();
  try {
    if (!fs.existsSync(p)) return null;
    return new Uint8Array(fs.readFileSync(p));
  } catch (e) {
    console.error(`[pulsewire] snapshot-read failed: ${(e as Error).message}`);
    return null;
  }
}

function fileSave(bytes: Uint8Array): void {
  const p = resolveSnapshotPath();
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, Buffer.from(bytes));
  fs.renameSync(tmp, p);
}

/* ------------------------------- Adapter -------------------------------- */

const DATABASE_LIST_RE = /^\s*pragma\s+database_list\s*;?\s*$/i;

class AdapterStatement implements SqlStatement {
  constructor(
    private readonly db: SqlJsDatabase,
    private readonly sql: string,
    private readonly onWrite: () => void,
  ) {}

  /** Snapshot model: the honest answer to "what file is this DB?" */
  private databaseListRows(): Row[] {
    return [
      {
        seq: 0,
        name: "main",
        file: isVercel() ? "" : resolveSnapshotPath(),
      },
    ];
  }

  private withStmt<T>(params: BindValue[], fn: (s: ReturnType<SqlJsDatabase["prepare"]>) => T): T {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(params);
      return fn(stmt);
    } finally {
      stmt.free();
    }
  }

  get(...params: BindValue[]): Row | undefined {
    if (DATABASE_LIST_RE.test(this.sql)) return this.databaseListRows()[0];
    return this.withStmt(params, (s) =>
      s.step() ? (s.getAsObject() as Row) : undefined,
    );
  }

  all(...params: BindValue[]): Row[] {
    if (DATABASE_LIST_RE.test(this.sql)) return this.databaseListRows();
    return this.withStmt(params, (s) => {
      const rows: Row[] = [];
      while (s.step()) rows.push(s.getAsObject() as Row);
      return rows;
    });
  }

  run(...params: BindValue[]): RunResult {
    this.db.run(this.sql, params.length > 0 ? params : undefined);
    const changes = this.db.getRowsModified();
    let lastInsertRowid = 0;
    const r = this.db.exec("SELECT last_insert_rowid() AS id");
    if (r.length > 0 && r[0].values.length > 0) {
      lastInsertRowid = Number(r[0].values[0][0]);
    }
    this.onWrite();
    return { changes, lastInsertRowid };
  }
}

const WRITE_SQL = /^\s*(insert|update|delete|replace|create|drop|alter|vacuum|begin|commit)/i;

class AdapterDb implements SqlDatabase {
  constructor(private readonly db: SqlJsDatabase) {}

  prepare(sql: string): SqlStatement {
    return new AdapterStatement(this.db, sql, () => markDirty());
  }

  exec(sql: string): void {
    this.db.exec(sql);
    if (WRITE_SQL.test(sql)) markDirty();
  }

  pragma(_directive: string): unknown {
    // WAL/busy_timeout are meaningless for an in-memory image; accept and ignore.
    return [];
  }

  transaction<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
    return (...args: A) => {
      globalForSql.__pwSqlInTxn = true;
      this.db.exec("BEGIN");
      try {
        fn(...args);
        this.db.exec("COMMIT");
      } catch (e) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
          // ignore
        }
        throw e;
      } finally {
        globalForSql.__pwSqlInTxn = false;
      }
      markDirty();
    };
  }

  close(): void {
    flushSync();
    this.db.close();
  }

  export(): Uint8Array {
    return this.db.export();
  }
}

/* ---------------------------- Init & lifecycle --------------------------- */


/**
 * Resolve the sql-wasm.wasm path at runtime without a statically analyzable
 * specifier — webpack must never try to bundle the .wasm as a module.
 */
function wasmBinaryBytes(): Buffer {
  const { createRequire } = require("module") as typeof import("module");
  const runtimeRequire = createRequire(
    path.join(process.cwd(), "package.json"),
  );
  const spec = ["sql.js", "dist", "sql-wasm.wasm"].join("/");
  try {
    return fs.readFileSync(runtimeRequire.resolve(spec));
  } catch {
    return fs.readFileSync(path.join(process.cwd(), "node_modules", spec));
  }
}

export async function initSqlDb(): Promise<void> {
  if (!globalForSql.__pwSqlModule) {
    const wasmBinary = wasmBinaryBytes();
    globalForSql.__pwSqlModule = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer });
  }
  const key = isVercel() ? "blob" : resolveSnapshotPath();
  if (globalForSql.__pwSqlDb && globalForSql.__pwSqlDbKey === key) return;

  const SQL = globalForSql.__pwSqlModule;
  const image = isVercel() ? await blobLoad() : fileLoad();
  const raw = image ? new SQL.Database(image) : new SQL.Database();
  globalForSql.__pwSqlDb = new AdapterDb(raw);
  globalForSql.__pwSqlDbKey = key;
  globalForSql.__pwSqlDirty = false;
  console.info(
    `[pulsewire] sqldb open driver=${isVercel() ? "blob" : "file"} loaded=${image ? image.length : 0}B`,
  );
}

/** Raw sql.js module — tests open snapshot images directly. */
export async function initSqlJsModuleForTests() {
  if (!globalForSql.__pwSqlModule) {
    const wasmBinary = wasmBinaryBytes();
    globalForSql.__pwSqlModule = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer });
  }
  return globalForSql.__pwSqlModule;
}

export function isSqlDbReady(): boolean {
  return Boolean(globalForSql.__pwSqlDb);
}

export function getSqlDb(): SqlDatabase {
  const db = globalForSql.__pwSqlDb;
  if (!db) {
    throw new Error(
      "[pulsewire] sqldb not initialized — instrumentation.ts must await initSqlDb() before first use",
    );
  }
  // Re-key when tests swap PULSEWIRE_DB_PATH mid-process.
  const key = isVercel() ? "blob" : resolveSnapshotPath();
  if (globalForSql.__pwSqlDbKey !== key) {
    throw new Error(
      "[pulsewire] sqldb path changed after init — call reopenSqlDbForTests()",
    );
  }
  return db;
}

/** Tests swap PULSEWIRE_DB_PATH; reload the snapshot for the new path. */
export async function reopenSqlDb(): Promise<void> {
  if (globalForSql.__pwSqlDb) {
    try {
      globalForSql.__pwSqlDb.close();
    } catch {
      // ignore
    }
  }
  globalForSql.__pwSqlDb = undefined;
  globalForSql.__pwSqlDbKey = undefined;
  await initSqlDb();
}

/* ------------------------------ Persistence ------------------------------ */

function markDirty(): void {
  globalForSql.__pwSqlDirty = true;
  if (globalForSql.__pwSqlInTxn) {
    // Flush after COMMIT — exporting mid-transaction aborts it.
    return;
  }
  if (isVercel()) {
    scheduleAsyncFlush(3000);
    return;
  }
  if (isTestLike()) {
    // Tests assert on-disk persistence immediately after writes.
    flushSync();
    return;
  }
  scheduleSyncFlush(500);
}

function scheduleSyncFlush(ms: number): void {
  if (globalForSql.__pwSqlFlushTimer) return;
  globalForSql.__pwSqlFlushTimer = setTimeout(() => {
    globalForSql.__pwSqlFlushTimer = null;
    flushSync();
  }, ms);
  globalForSql.__pwSqlFlushTimer.unref?.();
}

function scheduleAsyncFlush(ms: number): void {
  if (globalForSql.__pwSqlFlushTimer) return;
  globalForSql.__pwSqlFlushTimer = setTimeout(() => {
    globalForSql.__pwSqlFlushTimer = null;
    void flushDbNow();
  }, ms);
  globalForSql.__pwSqlFlushTimer.unref?.();
}

function flushSync(): void {
  const db = globalForSql.__pwSqlDb;
  if (!db || !globalForSql.__pwSqlDirty) return;
  if (globalForSql.__pwSqlInTxn) return;
  if (isVercel()) return; // blob flushes are async-only
  try {
    fileSave(db.export());
    globalForSql.__pwSqlDirty = false;
  } catch (e) {
    console.error(`[pulsewire] snapshot-write failed: ${(e as Error).message}`);
  }
}

/**
 * Flush the snapshot now. Await after critical writes (X spend, usage) on
 * Vercel; a no-op when nothing is dirty.
 */
export async function flushDbNow(): Promise<void> {
  const db = globalForSql.__pwSqlDb;
  if (!db || !globalForSql.__pwSqlDirty) return;
  if (!isVercel()) {
    flushSync();
    return;
  }
  if (globalForSql.__pwSqlFlushing) {
    await globalForSql.__pwSqlFlushing;
    return;
  }
  const bytes = db.export();
  globalForSql.__pwSqlFlushing = blobSave(bytes)
    .then(() => {
      globalForSql.__pwSqlDirty = false;
    })
    .catch((e: Error) => {
      console.error(`[pulsewire] blob-flush failed: ${e.message}`);
    })
    .finally(() => {
      globalForSql.__pwSqlFlushing = null;
    });
  await globalForSql.__pwSqlFlushing;
}

process.on?.("beforeExit", () => flushSync());
