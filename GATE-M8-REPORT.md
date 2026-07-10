# GATE-M8 REPORT — X Governor

**Date:** 2026-07-10 · **Branch:** `cursor/v4-signal-fusion-bbb4`  
**Spec:** `SPEC-v4-signal-fusion.md` §4 · **Milestone:** M8

**Precondition:** M7 fusion core green.

---

## Suite

```
npm run test:e2e
```

Cumulative + `tests/gate-m8-x-governor.spec.ts`.  
**@live:** `npm run test:e2e:live` includes one earned deep-refresh call (manual trigger).

---

## Shipped (M8)

| Slice | What |
|---|---|
| **Governor** | `lib/x-governor.ts` — earned triggers only; never timer-polled |
| **Triggers** | heat_escalation · reddit_spike · tripwire · manual_deep |
| **Caps** | `X_CALLS_DAILY_CAP=20`, `X_CALLS_COOLDOWN_MIN=30`, `X_MONTHLY_CAP=300` |
| **UI** | Footer `X: n/20 today`; pause strip when capped; long-press ↻ = deep refresh |
| **x_search** | `fetchXAfterGrant` only after `requestXSearch` grant; cache-only otherwise |

---

## Cost actuals (this gate)

| Call | Trigger | Notes |
|---|---|---|
| Fixture suite | simulated | **0 live x_search** under `PW_TEST` (auto-earn skipped unless `PW_X_GOV=1`) |
| Live smoke | `manual_deep` | **≤1** real call when `npm run test:e2e:live` with key |

Expected production: quiet day 3–8, wild day ≤20. Monthly ceiling 300.

---

## Quiet choices

- Auto heat/reddit/tripwire earns disabled under `PW_TEST` (set `PW_X_GOV=1` for simulate fixtures).
- Heat escalation requires a recorded below-yellow sample then a cross (no boot storm).
- Legacy `refreshXPulse` / forceRefresh no longer spend X without a grant.

---

## Stop

M8 gate reported. **M9 tuning week not started** (needs daily human use + `tuning-log.md`). Waiting on human check.
