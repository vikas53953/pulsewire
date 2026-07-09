# M5 GATE REPORT — Baselines & history

**Date:** 2026-07-10 · **Branch:** `cursor/pulsewire-hot-news-bbb4` · **PR:** https://github.com/vikas53953/pulsewire/pull/1  
**Scope freeze:** `M5-SCOPE-FREEZE-v3-PARKING-LOT.md` (v3 Brief / Vibe / Radar parked — not built)

---

## 1. Suite summary — GREEN

```
npm run test:e2e
28 skipped (mobile once-only)
30 passed
0 failed
```

Includes cumulative gates: bugs, M1/M2, M3 UI, v1.1, M4 verdict, boot-velocity, **M5 baselines**.

M5 specs (`tests/gate-m5-baselines.spec.ts`):
- history writer persists + backup/reopen count matches
- seeded markets bucket → `calibrating: false` + blend; unseeded tech → `calibrating: true`
- cold start shows `~` on chips
- median / MAD / sigmoid unit assert via `/api/history-stats`

Boot-velocity (`tests/boot-velocity.spec.ts`): quiet fixture never false-red after refresh.

---

## 2. `pulsewire.db` row count

Moat clock started on live restart **2026-07-09T19:36:51Z**.

| Observation | Value |
|---|---|
| Path | `data/pulsewire.db` (WAL) |
| Rows after ~10 forced refresh cycles | **77** (11 × 7 sections) |
| Span | `19:36:51Z` → `19:37:07Z` |
| Multi-hour run | **Not yet** — leave `npm run dev` up; re-check with the verify block below |

> Playwright e2e clears `data/pulsewire.db*` at suite start. Copy the file before running tests if you need the live moat series.

---

## 3. Calibrating chip screenshot

<img alt="M5 calibrating chips showing ~ on every section" src="/opt/cursor/artifacts/screenshots/m5-calibrating-chips.png" />

Quiet fixture + empty history → every chip shows score + 🟡 + **`~`**.

---

## 4. Root-cause notes (what fought back)

1. **Override cache poison** — `pwQuiet` / `pwHotMarkets` rebuilt the shared in-memory pool and left it for later tests → empty India / missing NEW stickers / wrong windows. **Fix:** clear cache in `finally` only for pool-shape overrides (not `pwLlmFail`, so short-TTL HIT still works).

2. **`PULSEWIRE_DB_PATH` under Next** — bare `process.env.FOO` can be compiled away. **Fix:** bracket access + `next.config.mjs` `env` passthrough; e2e uses `data/e2e-pulsewire-${PORT}.db`.

3. **WAL + close/reopen under Next** — closing the singleton then reopening often saw 0 rows / `SQLITE_CANTOPEN` (multi-graph + async `backup()`). **Fix:** keep live handle; persist proof = `await db.backup(path)` then open the copy (quiet choice logged in `implementation-notes.md`).

4. **Stale `next dev` process** — long-lived server from pre-M5 kept answering on :3000 after code landed; history writes went to a deleted inode. **Fix:** hard-restart `npm run dev` after M5 merge; confirm log line `history-db open path=.../data/pulsewire.db`.

5. **Wrong browser port** — app listens on **3000**, not 3001 (`ERR_CONNECTION_REFUSED` on 3001 is expected).

---

## 5. Cost note (M5)

M5 adds **no** new LLM / `x_search` / push spend. History is local SQLite.  
Baseline: existing RSS + optional Grok summarize + capped X Pulse unchanged from v1.1.

---

## 6. Verify yourself (3 steps)

1. **Suite:** from repo root, `npm run test:e2e` → expect **30 passed / 0 failed**.
2. **Moat clock:** with `npm run dev` on :3000, hit refresh a few times, then:
   ```bash
   node -e "const D=require('better-sqlite3'); const db=new D('data/pulsewire.db'); console.log(db.prepare('SELECT COUNT(*) n FROM section_history').get()); db.close();"
   ```
   Count should rise over hours (leave it running overnight for the multi-hour number).
3. **Calibrating UI:** open `http://localhost:3000/` on a fresh DB (or after wiping `data/pulsewire.db*`) → chips show **`~`** until that IST hour×weekday bucket has ≥14 samples. Restart the process on a quiet market → verdict must not false-🔴 (`tests/boot-velocity.spec.ts`).

---

## 7. Stop

M5 gate reported. **v3 Brief / Vibe / Radar not started.** Waiting on Vikas human check + `SPEC-v3-radar-vibe-brief.md`.
