# Vercel migration — design (Fable, in progress)

Goal: `git push` → Vercel auto-deploys. No local server, no tunnel, no Grok.

## Why not as-is
Vercel is serverless: no always-on warmer process, no durable disk. The SQLite
file (baselines/streaks/usage/X-governor — the moat) dies on every cold start.

## Architecture chosen: sync in-memory SQLite + snapshot persistence
The scoring hot path calls the DB synchronously (score.ts → history.ts), so an
async driver port would ripple through the whole app. Instead:

1. **`sql.js` (SQLite-as-WASM, synchronous API)** replaces `better-sqlite3`.
   A thin adapter in `lib/sqlite-adapter.ts` mimics the better-sqlite3 surface
   actually used: `prepare().get/all/run`, `exec`, `pragma`, `transaction`.
   All 9 consumer files keep their SQL and their synchronous call sites.
2. **Persistence = whole-DB snapshots** (standard SQLite file image):
   - Local/dev: written to `data/pulsewire.db` (same file as today — existing
     data loads unchanged). Debounced sync write after mutations.
   - Vercel: loaded from **Vercel Blob** on cold start; flushed back on a
     debounce + forced flush after critical writes (X-governor spend, usage).
     Needs `BLOB_READ_WRITE_TOKEN` (one dashboard click).
3. **WASM init is async once**: `instrumentation.ts` awaits `initDb()` at boot
   (Next awaits register() on every cold start, locally and on Vercel).
   Vitest gets an async setup file; scripts await init explicitly.
4. **Warmer**: interval warmer skipped when `VERCEL=1` (no long-lived process);
   request-driven stale-while-revalidate (already in cache.ts) carries warming.
   First morning visitor pays one warm; everyone else hits hot cache.
5. **better-sqlite3 removed** entirely — also kills the node-gyp native build
   pain on every contributor machine.

## Accepted tradeoffs (beta-scale)
- Snapshot persistence can lose the last few seconds of writes on instance
  freeze (history samples/usage pings — tolerable; governor forces flush).
- Concurrent instances: last-write-wins on the image. Single region + 10-min
  cache + ~50 users ⇒ effectively one live instance. Revisit before scale.

## Rollout
- PR A: adapter + persistence + dep swap + warmer gate + docs (this design).
- PR B: `vercel.json`, README deploy section, remove backup cron from docs
  (Blob is durable; keep `npm run backup:db` for local).
- Vikas clicks (dashboard only): import GitHub repo into Vercel → Storage →
  create Blob store (token auto-injected) → set env `BETA_TOKEN` (+ existing
  .env values he wants) → Deploy.
