# GATE-V3 RE-GATE — human-check fixes (BUG-V1/V2/V3 + naming)

**Date:** 2026-07-10 · **Branch:** `cursor/v3-radar-vibe-brief-bbb4`  
**Prior:** v3 GATE FAILED on human check (34 green tests, live UI broken).

---

## Suite — GREEN

```
npm run test:e2e
36 skipped (mobile once-only + @live excluded)
38 passed
0 failed
```

Includes cumulative gates through M5 + expanded `tests/gate-v3.spec.ts` (V1–V3 + naming).

**@live smokes (manual, not CI):** `npm run test:e2e:live`  
Fixtures prove logic; live smokes prove Reddit RSS / Radar feeds / X key reality.

---

## Fixes

| ID | Fix |
|---|---|
| **BUG-V1** | Vibe columns `{ status, items, note }` — `ok \| quiet \| failed \| pending \| needs_key`. Chip click + warmer force `/api/vibe?refresh=1`. Failure never looks like quiet. |
| **BUG-V2** | Radar diffs listing item IDs (SQLite JSON snapshot), never page hash. Untitled / `*changed` titles do not trip. Playwright `diff-fixture`: same items → no trip; new item → trip with headline. |
| **BUG-V3** | Verdict only via `radarVerdictFromTrips` with real headline (`🔴 Radar: {name} — {headline}`). Radar StatusBar uses `polledAt` (no blank UPDATED —). |
| **NAMING** | Chip **RADAR 📡**. Columns **On X** / **On Reddit**. |

---

## Evidence

<img alt="Vibe both columns" src="/opt/cursor/artifacts/screenshots/v3-vibe-both-columns.png" />

Fixture Vibe under `PW_TEST`: both columns populated; RADAR 📡 chip; footer `UPDATED JUST NOW`.

---

## Process note (owner)

34 green tests previously validated fixtures while live Reddit auth, x_search trigger, and real RBI-style pages were never exercised. That is why the human check exists. `@live` smokes are now mandatory before any gate report; CI stays fixture-only.

---

## Cost notes (unchanged)

| Feature | Estimate |
|---|---|
| Brief | cache-steady ≈ $0 |
| Vibe | Reddit $0; X shares `X_PULSE_MONTHLY_CAP` |
| Radar | polling $0; push = M6 |

---

## Stop

Re-gate reported. Waiting on human check. No further scope without a new spec.
