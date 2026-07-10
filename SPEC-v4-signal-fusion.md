# SPEC v4 — PulseWire "Signal Fusion"

**Owner:** Vikas · **Builder:** Grok 4.5 · **Date:** 2026-07-10  
**Precondition (hard):** v3 re-gate must be GREEN first (BUG-V1/V2/V3 fixed, live smoke tests passing). Do not start v4 on a broken Vibe.  
**Supersedes:** Vibe as a tab, Radar as a chip. Both dissolve into the fusion layer described here.  
**Positioning unchanged:** status page for the world; verdict first; quiet is a win; the app must never lie.

---

## 1. Core architecture change: three planes, one pipeline

Every section (MKT/IND/ECO/TEC/POL/SPT/WLD) is now fed by three signal planes with different speed/trust:

| Plane | Latency | Trust | Cost | Role |
|---|---|---|---|---|
| **X** (x_search) | minutes | LOW (unverified) | PAID — governed | Early warning |
| **Reddit** (OAuth JSON / RSS) | ~10–30 min | MEDIUM (crowd) | Free | Crowd confirmation |
| **RSS** (existing engine) | ~30–90 min | HIGH (published) | Free | Ground truth |

**Fusion rule:** planes feed ONE cluster store per section. A cluster's evidence set = which planes have seen it. No separate Vibe tab, no separate Radar chip — the VIBE and RAD chips are removed from the UI. Radar tripwires (RBI/NSE/labs, 60s polling) remain as a mechanism: a tripwire hit enters the pipeline as an RSS-plane item with `tripwire: true` (instant, verified source ⇒ can go straight to 🔴).

## 2. Signal states per cluster (visible product concept)

```
⚡ EARLY      seen on X only            → grey-yellow tile edge, label "early · unconfirmed"
◐ BUILDING    X + Reddit, no RSS yet    → yellow, "gaining traction"
🔥 CONFIRMED  any plane + RSS (2+ src)  → full hot treatment as today
```

Rules:
- EARLY items may appear in a section (max 2, below confirmed items) but are ALWAYS labeled. An unlabeled rumor is the product lying — gate-failing offense.
- EARLY items never drive the verdict alone. Verdict may say at most: "Something's brewing in Markets — loud on X, no wire confirmation yet." (template `brewing`, yellow level max).
- Only CONFIRMED clusters can produce a red verdict (exception: `tripwire:true` items — official source = confirmed by definition).
- Cross-plane matching: normalize titles/keywords; LLM assist allowed within the existing batched call (no new call class). If matching is uncertain, planes stay separate — never force-merge.

## 3. Pulse Score v2 (fusion-aware)

```
planeWeight: RSS source = 1.0 · tripwire = 1.5 · Reddit signal = 0.6 · X signal = 0.4
breadth(c)  = Σ planeWeight over distinct evidence
velocity(c) = weighted evidence added per rolling 60 min
crossBonus  = ×1.3 if evidence spans ≥2 planes, ×1.6 if all 3   # correlation is the alpha
storyHeat   = (2*breadth + 3*velocity) * recencyW * crossBonus
```
Baseline/deviation math from M5 unchanged, applied on top. Chips gain a tiny plane indicator when a section's heat is social-led: `MKT 73🔴 ⚡` (heat includes unconfirmed early signal).

## 4. X cost governor — escalation-triggered, never scheduled

**Principle: PulseWire never polls X on a timer. X calls must be EARNED by another plane.**

Triggers (any one):
1. **Heat escalation:** a section's RSS+Reddit heat crosses its 🟡 threshold → one x_search for that section to check social velocity ("is this bigger than the wires show?").
2. **Reddit spike:** a Reddit item enters top-N rising with velocity above baseline → one x_search to corroborate that story only.
3. **Tripwire hit:** radar fires → one x_search for social context on that event.
4. **Manual:** user taps ↻ with a (new) long-press "deep refresh" → one call, rate-limited to 4/day.

Budget enforcement (env, hard):
```
X_CALLS_DAILY_CAP=20          # hard stop; beyond it, EARLY plane goes dark, app says so honestly
X_CALLS_COOLDOWN_MIN=30       # per section — same section can't trigger twice inside cooldown
X_MONTHLY_CAP=300             # absolute ceiling, overrides everything
```
Footer shows `X: 7/20 today`. When capped: small strip "⚡ early-signal plane paused (daily budget) — wires & Reddit still live." Honest, not silent.
**Expected spend:** quiet day 3–8 calls, wild day 20. At current x_search unit pricing this is rupees/day. Report actuals in the gate report (standing rule #4).

## 5. Reddit plane (free, continuous)

- OAuth script app / Atom RSS with proper user-agent (from v3 fix). Poll every 10 min with the fleet warmer: r/all rising + per-section curated subs (config file `reddit.config.ts`: IndiaSpeaks/india, IndianStockMarket/IndiaInvestments, technology/india tech, Cricket, worldnews, geopolitics — editable).
- Signal = post velocity (score+comments/hour) above sub baseline, not absolute score (avoids meme-domination).
- Reddit items are SIGNALS attached to clusters, not standalone tiles — except: a Reddit-only item with extreme velocity may appear as EARLY (same rules as X-only).

## 6. UI deltas (small — fusion is mostly invisible, as it should be)

- VIBE and RAD chips removed. Radar strip stays (only when tripped, with real headline — per BUG-V2 fix).
- Tile evidence line: `Moneycontrol +2 · r/IndianStockMarket ▲ · ⚡ X` — planes visible per story.
- EARLY/BUILDING visual states per §2 (zine style: dashed border for EARLY).
- Brief overlay (v3) gains one line when social-led: "First seen on X, N min before wires."
- Everything else untouched.

## 7. Milestones

**M7 — Fusion core:** cluster store accepts multi-plane evidence; score v2; EARLY/BUILDING states; Reddit plane wired as signals; VIBE/RAD chips removed. Fixtures: cross-plane merge, EARLY labeling, early-never-red rule.
**M8 — X governor:** escalation triggers 1–4; caps/cooldowns; honest budget-exhausted state; footer counter. Fixtures simulate triggers; live smoke = one real earned call logged with its trigger reason.
**M9 — Tuning week:** Vikas uses it daily; every verdict lie recorded in `tuning-log.md`; adjust weights/thresholds only from that log. No new features during M9.

Gate discipline unchanged: cumulative Playwright + live smoke per external integration + cost actuals in every report.

## 8. Horizon note (NOT scoped — written so we aim at it)

v5 = delivery inversion: verdict-as-notification (WhatsApp/push), silence by default, app as tap-through. The fusion layer built here is exactly what makes a pushed verdict trustworthy enough to interrupt someone. Nothing in v4 may contradict this direction (e.g., no engagement mechanics that assume the user lives inside the app).

## 9. Success test for v4 (falsifiable)

Within M9's tuning week, at least twice: PulseWire surfaces a story (EARLY/BUILDING) ≥20 minutes before it appears in any of Vikas's RSS feeds, AND zero red verdicts are triggered by unconfirmed signals. If the first never happens, the social planes aren't earning their complexity — we remove them rather than carry dead weight. If the second is violated even once, fusion trust rules get stricter before anything else ships.
