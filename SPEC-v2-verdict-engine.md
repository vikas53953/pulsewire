# SPEC v2 — PulseWire "Verdict Engine"

**Owner:** Vikas · **Builder:** Grok 4.5 · **Date:** 2026-07-10
**Supersedes:** ranking/UI-hero sections of SPEC v1. Feed engine, cache, LLM merge, Bento Zine visual language, and test-gate discipline all carry forward.
**Positioning (lock, use in all copy decisions):** *Inshorts shortens news. PulseWire tells you whether you need news at all.*
**Wedge:** Indian traders / finance-curious Gen-Z. Markets is the flagship section; defaults favor it.

**Answer to Grok's open question:** M4 = **formula-only score, no persistence**. Score v0 computes from the in-memory 24h pool alone. Persistence (SQLite) lands in M5. Reason: verdict UX can be validated in days; baselines need weeks of data anyway — start *collecting* early in M5, but don't block M4 on storage design.

---

## 1. Product definition

PulseWire is a **status page for the world**. A visit is successful when the user leaves in under 20 seconds with a verdict — including, most days, "all quiet." Quiet is a win state, never an apology.

**Non-goals (unchanged + strengthened):** no articles in-app, no accounts, no comments/saves, no notifications (v2), no infinite feed mechanics of any kind. If a feature increases time-in-app without increasing confidence-per-second, reject it.

## 2. Pulse Score — the alpha

### 2.1 Score v0 (M4 — computable from the 24h in-memory pool)

Per section, per request window:

```
For each story cluster c (post-merge):
  breadth(c)   = distinct source count (1..N)
  velocity(c)  = max sources added in any rolling 60-min span
                 (from per-source firstSeen timestamps — engine must start
                 recording firstSeen per source per cluster NOW)
  recencyW(c)  = exp(-ageHours(c) / 6)        # half-life ~4h

storyHeat(c)   = (2*breadth(c) + 3*velocity(c)) * recencyW(c)

sectionRaw     = max(storyHeat) + 0.5 * secondMax(storyHeat)
                 # one huge story OR two big ones = hot; ten tiny pings ≠ hot

PulseScore     = round(100 * sectionRaw / (sectionRaw + K))   # K=8 tuning constant
```

Traffic-light thresholds (v0, tune later): 🟢 0–39 · 🟡 40–69 · 🔴 70–100.

Rationale: velocity weighted above breadth (spread *rate* is the breaking-news signal); saturation curve instead of linear so scores are stable and comparable across sections; multiplicative recency so a dead story cools even with many sources.

### 2.2 Score v1 (M5 — baseline deviation, the compounding moat)

- Persist every cycle: `(section, timestamp, sectionRaw, clusterCount, topBreadth)` to **SQLite** (`pulsewire.db`, one file, better-sqlite3).
- Baseline = median + MAD of `sectionRaw` for the same **hour-of-day × weekday** bucket over trailing 60 days (same math as SNMP baseline anomaly detection — Markets at 9:15 IST Monday is *normally* loud; that's not an alert).
- `deviation = (sectionRaw − median) / MAD`; blend into score: `PulseScore_v1 = 0.6*v0 + 0.4*sigmoid(deviation)` scaled to 0–100.
- Cold-start rule: until a bucket has ≥14 samples, show v0 and a subtle `calibrating` tag on the chip tooltip. Never fake confidence.
- **Start writing history at the first minute of M5 even though deviation ships at its end** — data collection is the long pole.

## 3. Verdict line — the hero

First element in the viewport. One sentence, generated **rule-based first, LLM-polished optionally** (verdict must work in RAW mode too).

Rule templates (deterministic, testable):

| Condition (across sections in current lens) | Verdict |
|---|---|
| all scores 🟢 | "All quiet. Nothing needs you right now." |
| one 🟡, rest 🟢 | "Mostly quiet. {Section} is warming up — {top story, 8 words}." |
| one 🔴 | "🔴 {Section} is hot — {top story}, {breadth} sources in {span}." |
| 2+ 🔴 | "🔴 Busy: {SectionA} and {SectionB} both moving. Start with {hotter}." |
| delta lens, nothing new | "Nothing changed since you left ({relative time}). Go live your life." |

LLM polish (only when key present): rewrite the template output for tone, hard cap 140 chars, MUST preserve section names, counts, and color. On any LLM failure → template text as-is. Verdict is cached with the section data (no extra latency).

## 4. Delta-first lens

- Two lenses, toggle at top: **"Since you left"** (default from 2nd visit onward) and **"Windows"** (1h/4h/12h/24h, unchanged behavior).
- `lastVisit` from localStorage (`pagehide` write — already built). API accepts `?since=<ISO>`; server slices the pool by `firstSeen > since` per cluster (a story is "new to you" if it *gained its 🔥 or first appeared* after your last visit).
- First-ever visit: Windows lens at 4h, no NEW logic.
- The verdict line always speaks in the active lens's terms.

## 5. Ranking (replaces recency-first)

Within the active lens/window:
1. Sort clusters by `storyHeat` desc.
2. **Age-diversity constraint** (approved "yes"): for 4h+ windows, after picking the top 3 by heat, remaining slots must span age buckets (0–25%, 25–50%, 50–100% of window) where candidates exist.
3. **Fewer-but-stronger** (approved): render only clusters with `storyHeat ≥ 0.15 * topHeat`, floor 2, cap 9. Never pad.
4. Mega tile = top heat cluster. Tile meta gains a small heat chip: `▲ 5 src/40m` when velocity ≥3, else source count only.

## 6. UI contract (Bento Zine language carries over)

```
┌──────────────────────────────────────┐
│ PULSE[WIRE]        [Since you left ▾]│  lens toggle replaces window pills
│                                      │  (Windows lens re-shows 1h/4h/12h/24h)
│  ❝ 🔴 Markets is hot — RBI shock,    │  VERDICT: sticker-frame card, ink
│     6 sources in 40 min. ❞           │  border, 20-22px/900. THE hero.
│                                      │
│ MKT 87🔴  IND 34🟢  ECO 51🟡  TEC 12🟢│  score chips row — tap = filter to
│ POL 22🟢  SPT 45🟡  WLD 30🟢         │  that section (replaces tab pills)
├──────────────────────────────────────┤
│  [mega tile — top-heat story]        │  evidence zone: bento as before,
│  [tile][tile]  (only strong ones)    │  fewer-stronger, full flash headlines
├──────────────────────────────────────┤
│ updated 1m · you left 3h ago · ↻     │
└──────────────────────────────────────┘
```

- Score chips: monospace number + emoji dot, zine border; active chip = sticker-yellow. Chips ARE the navigation now (section tabs retire; "All" = no chip selected).
- Full flash headlines everywhere: 140–160 chars, end on a full word; RAW mode shows full cleaned RSS title (strip trailing " - Publisher" suffixes only).
- Quiet state is a designed hero, not an empty state: big verdict + a single small line "Top of the quiet: {one headline}" and nothing else. Resist filling space.
- Everything else (tokens, shadows, stickers, dark toggle, a11y floor, motion restraint) per the locked M3 brief.

## 7. API changes

`GET /api/highlights?section&lens=window|since&window=4h&since=<ISO>&refresh=1`

Response additions:
```json
{
  "verdict": { "text": "…", "level": "red|yellow|green", "llmPolished": false },
  "scores":  [ { "section": "markets", "score": 87, "level": "red", "calibrating": false } ],
  "items":   [ { "…existing…", "heat": 41.2, "velocity": 5, "firstSeen": "…" } ]
}
```
`scores` covers ALL sections regardless of the section filter (chips need them). Backward-compat not required — internal API.

## 8. Milestones & gates (test-first, cumulative suite)

**M4 — Verdict shell** (formula-only)
- firstSeen tracking per cluster-source; storyHeat + PulseScore v0; verdict templates; lens toggle + `?since`; ranking §5; full flash headlines; chips UI; quiet hero.
- Playwright (fixtures with controlled firstSeen times): quiet fixture → green verdict "All quiet"; hot fixture (5 sources/40m) → red verdict naming Markets with correct counts; 4h view spans age buckets; no tile below heat floor; RAW mode verdict = template text; chips render all sections; since-lens shows only post-`since` clusters.
- Gate: suite green + Vikas 2-min phone check: "does the verdict feel *true*?"

**M5 — Baselines & velocity curves**
- SQLite history writer (from day one of M5); baseline math + deviation blend; calibrating tag; velocity sparkline on 🔴 chips (tiny, zine-styled); `since` moves fully server-side.
- Playwright: seeded DB fixture → deviation math asserted; cold-start shows calibrating; history writer survives restart.

**M6 — Wedge polish → Vercel**
- Markets-default copy/order for pylabmit audience; WhatsApp share per tile; PWA manifest+SW; then Phase-2 deploy (SQLite → Vercel-compatible store: Turso/libSQL, decide at M6 start).

## 9. Success metric (so we know the pivot worked)

Instrument locally, no analytics service: median session < 25s, AND ≥50% of sessions end on a green/quiet verdict without a single tile click. If people *must* click tiles every visit, the verdict isn't carrying its weight — fix the verdict, don't add features.
