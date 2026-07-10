# Implementation notes

## Feed swaps (M1)

| Spec source | Status | Action |
|---|---|---|
| Business Standard Economy RSS | HTTP 403 (Access Denied) from this environment | Replaced with **The Hindu Business Line** economy feed: `https://www.thehindubusinessline.com/economy/?service=rss` |
| Hindustan Times India | Spec said "Hindustan Times India" | Using HT India News feed: `https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml` (alive) |

## Hybrid Google News (M2)

Per product direction: **Google News India-edition topic/search feeds as the broad net**, plus **2–3 direct top-story feeds as the fast lane**.

| Section | Google News feed |
|---|---|
| India | topic `NATION` (`hl=en-IN&gl=IN`) |
| Markets | topic `BUSINESS` |
| Economy | search `India economy when:1d` (no dedicated Economy topic) |
| Politics | search `India politics when:1d` |
| Sports | topic `SPORTS` |
| World | topic `WORLD` (already in M1) |
| Tech | topic `TECHNOLOGY` (already in M1) |

**Redirect resolution:** `lib/resolve-url.ts` best-effort follows/extracts publisher URLs. Google News article tokens are often opaque and do not redirect to the publisher; when resolution fails we keep the Google URL (still clickable) and note it here rather than dropping the item.

**Publisher labels:** For Google News items, the source name is taken from the trailing ` - Outlet` in the title when present (so merges can credit the real outlet).

## M1 scope (done)

- API returns items with real `publishedAt`, `stale`, `rawMode`
- `export const dynamic = 'force-dynamic'` on `/api/highlights`
- Default section when omitted: `all`. Default window: `4h`
- Manual bypass: `?refresh=1`

## M2 scope (done)

- Fuzzy similarity ≥0.6 pre-merge + 🔥 pin for multi-source stories
- Batched Grok summarizer/deduper via `LLM_*` env vars
- Raw-mode fallback with short TTL (`RAW_CACHE_TTL_MINUTES`, default 2)
- Without `LLM_API_KEY`, app stays in raw mode (merge still works) — never blanks

## M3 scope (done) — Bento Zine

Built exactly per `M3-design-brief-bento-zine.md`.

### Approved deviations from SPEC

| Spec | Brief | Action |
|---|---|---|
| SPEC §9 dark theme default | Light paper default + Night Zine toggle | **Followed brief** (approved deviation) |

### Quiet choices where brief was silent (logged)

- Default time window on first load: **4h** (matches API default; brief shows the control but does not name the initial selection).
- Empty-state CTA always labeled **TRY 4H**; if already on 4h/12h it steps to the next wider window (12h→24h) instead of no-op.
- Fetch error (network/API down): one zine tile with message + Retry — brief covered loading/empty/stale/raw but not hard fetch failure.
- `color-mix()` used for skeleton shimmer mid-tone (no extra token in brief).
- No bottom dock (explicitly rejected as Direction B).
- Section name on All-tab tiles uses the section id lowercase (`india`, `markets`, …) — brief asked for section name, not a display map.
- Night Zine: teal/lav tile text stays `#141414` (not inverted `--ink`) so pastel accents keep AA contrast; brief kept those accent colors unchanged but was silent on their foreground.

## BUG-1 / BUG-2 fixes + M4 (done)

### BUG-1 — root cause
Tab clicks felt slow because each first visit to a section triggered a cold RSS+LLM path (5–15s), and the UI kept painting the previous section’s tiles until the new response arrived. Fix: fleet-wide background warmer on boot + every `CACHE_TTL_MINUTES`; client clears tiles and shows skeleton immediately on tab change (`key={section-window}`); in-memory client cache makes revisits instant with soft revalidate.

### BUG-2 — root cause
Windows looked identical because (1) the cache was effectively window-shaped / shallow so older stories never survived, and (2) even with a deep pool, recency-sort + cap-10 let a burst of fresh minors fill all slots in every window. Fix: cache a deep 24h pool; slice+rank at request time (🔥 source-count desc → recency, with older-tier reserve slots); preserve earliest source `publishedAt` on merges; `?refresh=1` clears cache, sets `cacheMiss: true`, logs `[pulsewire] cache-miss …`, and returns `X-PulseWire-Cache: MISS`.

### Quiet M4 choices
- Warmer also started from the API route as a safety net if instrumentation is late.
- In-flight refresh de-duped per section via `setRefreshing` so boot warm + first request don’t double-fetch.

## M3.5 — Playwright automated gate (done)

- `PW_TEST=1` serves `lib/test-mode.ts` fixtures (ages 10m/50m/3h/9h-dup/20h) + stubbed LLM; `pwLlmFail` / `pwFeedsDown` / `pwEmpty` query overrides for state tests.
- Specs: `tests/bugs.spec.ts`, `tests/gate-m1-m2.spec.ts`, `tests/gate-m3-ui.spec.ts`.
- CI: `.github/workflows/e2e.yml` with HTML report artifacts.
- Standing rule: every future milestone ships with Playwright specs; suite is cumulative.

## M4 — Verdict Engine (done, SPEC v2)

- Pulse Score v0 from in-memory 24h pool: `(2×breadth + 3×velocity) × recencyDecay`, saturated with K=8.
- Rule-based verdict hero; LLM may polish only (never invent). Works in RAW.
- Score chips replace section tabs (Markets-first order). Lens: Since you left (default 2nd+ visit) / By time.
- Ranking: heat desc + age-diversity for 4h+ + fewer-stronger (floor 15% of top heat, cap 9).
- Full flash headlines (≤160 chars). Quiet = designed hero, not empty apology.
- **Boot-window velocity suppression:** clusters whose every `firstSeen` falls within 5 min of process boot score velocity=1 (breadth only). Prevents false 🔴 after restart/deploy (same trap on Vercel cold starts).

## M5 — Baselines & history (done)

- SQLite `section_history` via `better-sqlite3` (`data/pulsewire.db`, override `PULSEWIRE_DB_PATH`). Writer runs on every `scoreSection` cycle (warm + request) — starts the 60-day moat clock immediately.
- Baseline = median + MAD of `sectionRaw` for IST **hour × weekday**, trailing 60 days. `PulseScore_v1 = 0.6*v0 + 0.4*sigmoid(deviation)*100`. Bucket &lt;14 samples → v0 + `calibrating` (chip shows `~`).
- Velocity sparkline on 🔴 chips (`velocitySpark` heat series).
- Under `PW_TEST=1`, writer is off unless `PW_HISTORY=1` (Playwright webServer sets both + isolated `data/e2e-pulsewire-*.db`).
- Gate: `tests/gate-m5-baselines.spec.ts` (persist + reopen, seeded blend, calibrating UI, median/MAD math).
- Quiet choice (spec silent): persist-survive proof uses `db.backup()` + reopen of the copy (closing the live WAL handle under Next was flaky).
- Playwright only wipes `data/e2e-pulsewire-*.db` — live `data/pulsewire.db` is never deleted by the suite (moat clock).

## v3 — Brief · Vibe · Radar (done)

- **Brief:** tile tap → overlay; `clusterId`; SQLite `briefs`; RAW = title+sources only.
- **Vibe:** Reddit rising + X Pulse side-by-side (`/api/vibe`). Instagram permanently OOS.
- **Radar:** 60s tripwire poller; CLEAR/TRIPPED; red verdict hint; PWA manifest+SW stub (push = M6).
- Gate: `tests/gate-v3.spec.ts`. Cost notes in `GATE-V3-REPORT.md` / `SPEC-v3-radar-vibe-brief.md`.

### Human-check re-gate (BUG-V1/V2/V3 + naming)

- **BUG-V1:** Vibe columns are `{ status, items, note }` with honest states: `ok | quiet | failed | pending | needs_key`. Failure never looks like quiet. Chip click + warm cycle force `/api/vibe?refresh=1`. Headers **On X** / **On Reddit**.
- **BUG-V2:** Radar compares listing item IDs (JSON snapshot in SQLite), never page hashes. Untitled / “changed” titles do not trip. Pure `detectNewRssItems` + Playwright `diff-fixture`.
- **BUG-V3:** `radarVerdictFromTrips` only appends `🔴 Radar: {name} — {headline}`; malformed trips leave verdict alone. Radar tab StatusBar uses `radar.polledAt` (no blank UPDATED —).
- **NAMING:** chip **RADAR 📡** (not RAD).
- **@live smokes:** `tests/live-smoke.spec.ts` excluded from CI (`grepInvert`); run `npm run test:e2e:live` before gate reports. Fixtures ≠ reality.

## v1.1 — NEW stickers + X Pulse (done)

### NEW stickers
- `localStorage` key `pulsewire-last-visit` stores the previous session end (`pagehide`).
- Tiles with `publishedAt` after that timestamp get a red **NEW** sticker (client-side `isNew`).
- First visit (no key) → zero NEW stickers (nothing to compare against).

### X Pulse
- New section tab `xpulse` (`⚡ X Pulse`).
- Uses xAI **Responses API** + built-in `x_search` tool (Live Search successor) — not the official X API.
- Monthly hard cap via `X_PULSE_MONTHLY_CAP` (default 60); usage shown in footer on that tab.
- `PW_TEST=1` serves fixture pulses (no live x_search). Specs in `tests/gate-v11.spec.ts`.

## Cost guards (xAI key)

- `.env.local` holds `LLM_API_KEY` (gitignored). Never commit.
- `LLM_SUMMARIZE=0` (default): RSS sections + Brief stay raw/merge — no Grok polish on warm.
- `X_PULSE_MONTHLY_CAP=5` in local env (example default 10).
- Warmer Vibe uses `allowXFetch: false` — boot does not burn `x_search`.
- First intentional Vibe/X Pulse request spends **1** call; thereafter cache.

## v4 M7 — Signal Fusion core (done)

- Multi-plane evidence on clusters (`lib/fusion.ts`); EARLY/BUILDING/CONFIRMED.
- Pulse Score v2 plane weights + crossBonus; early-never-red brewing verdict.
- Reddit plane via `reddit.config.ts` (RSS); X attach from cache only (M8 earns live calls).
- VIBE/RAD chips removed; Radar strip only when tripped; tile evidence line.
- Gate: `tests/gate-m7-fusion.spec.ts` + `GATE-M7-REPORT.md`.

## v4 M8 — X Governor (done)

- `lib/x-governor.ts`: earned triggers only (heat / Reddit spike / tripwire / manual deep).
- Caps: daily 20, cooldown 30m/section, monthly 300. Footer `X: n/20 today` + pause strip.
- Long-press refresh → `/api/x-governor` deep-refresh (4/day).
- `getXPulseHighlights` is cache-only; live calls via `fetchXAfterGrant` after grant.
- Gate: `tests/gate-m8-x-governor.spec.ts` + live smoke one earned call.

## Mix visibility → TREND chip (owner feedback)

- Removed under-every-section lean mix strip and social wall (too much text).
- **TREND** chip after World opens a dedicated Reddit + X panel only.
- News desks (ALL / MKT / …) stay minimal: verdict + chips + tiles.
- Quiet choice: dissolve VIBE; TREND is the social surface.
- Lens: first visit shows **time pills only**; return visits get “Since last visit” / “By time”.
- Brand is a single **PulseWire** wordmark (no split heading / RAW sticker noise).
- Desk chips **wrap** (not horizontal-only scroll) so MKT…TREND stay visible.
- Board density: ALL ≤8, desk ≤10 for a 30s scan.
- First paint is **SSR** with real verdict + chips + tiles.