# SPEC-v3 — Brief · Vibe · Radar

**Owner:** Vikas · **Builder:** Grok 4.5 (Cursor) · **Date:** 2026-07-10  
**Positioning lock:** *Inshorts shortens news. PulseWire tells you whether you need news at all.*  
**Design principle:** Brief, Vibe, and Radar exist to **feed the verdict**. Any choice that turns PulseWire into a feed to scroll is wrong by definition.

Build order is fixed: **Brief → Vibe → Radar**. Ship each with Playwright; suite stays cumulative.

---

## v3.1 — BRIEF

### Intent
Tap a tile → zine overlay with four lines. One LLM call per cluster, ever. Still no full articles in-app.

### UX
- Tap tile opens overlay (does **not** navigate away).
- Overlay lines: **What happened / Why it matters / Who's affected / What's next.**
- Footer: primary source link (`target=_blank`) + Close.
- Escape / backdrop click closes.
- **RAW mode** (or LLM fail / unconfigured): overlay shows title + source list only — **no fake brief**.
- Quiet hero (no tiles) → no Brief.

### Data
- Expose stable `clusterId` on `HighlightItem` (hash of sorted member raw ids).
- `GET /api/brief?clusterId=…&title=…&sources=…` (or POST JSON body).
- Persist briefs in SQLite table `briefs` keyed by `clusterId` (one row forever).
- Test: `PW_TEST=1` returns fixture brief; `pwLlmFail=1` → RAW overlay shape.

### Cost note (Brief)
- Expected: ≤20 unique tile taps/day/user × 1 call/cluster cached forever.
- At ~$0.01–0.05/call (Grok chat): **~$0.20–1.00 / user / month** worst case if every tap is a new cluster; steady-state near **$0** after cache warm.
- Cap optional later; M3 ships without hard cap (cache is the control).

### Playwright
- Tap tile → overlay visible with 4 lines (fixture).
- RAW / llm-fail → title + sources, no four-line brief.
- Second tap same cluster → cache hit (no second LLM in test mode: assert `cached: true`).
- Escape closes. M3 “tiles are `<a>`” updated: tiles are buttons/openers; source link lives in overlay.

---

## v3.2 — VIBE

### Intent
Answer: *what's loud on X vs Reddit right now?* Side-by-side, not a doomscroll feed.

### UX
- New chip/section **Vibe** (or replace lone X Pulse entry with Vibe shell that embeds X + Reddit columns).
- Two columns: **Reddit** | **X Pulse**.
- Each column: ≤5 rising items (title + source + age). Tap opens external URL.
- Empty/fail column shows quiet one-liner, not a spinner forever.

### Data
- Reddit: public JSON (`r/all/rising` + curated: `india`, `IndiaInvestments`, `technology`, `worldnews`) — User-Agent required; no scraping Instagram (permanently OOS).
- X: existing `lib/x-pulse.ts` (cap unchanged).
- `GET /api/vibe` returns `{ reddit, xpulse, generatedAt, rawMode? }`.
- Cache ~5 min in-memory.

### Cost note (Vibe)
- Reddit: **$0** (public API).
- X Pulse: existing monthly cap (`X_PULSE_MONTHLY_CAP`, default 60). Vibe shares that meter — no extra budget.

### Playwright
- Vibe chip opens two columns.
- Fixture Reddit + X items render.
- Feeds-down / empty → quiet empty state per column.

---

## v3.3 — RADAR

### Intent
Defined event on a defined source → instant 🔴 verdict signal. Not a second news feed.

### UX
- Radar status strip or chip: **CLEAR** / **TRIPPED** with tripwire name.
- When tripped: verdict hero prefers Radar line (🔴) over RSS heat if Radar is louder.
- No infinite tripwire list UI in v3 — config is code (`lib/radar.config.ts`).

### Data
- Poll tripwires every **60s** (separate from 10-min RSS warmer).
- Starter tripwires (quietest set):
  1. RBI press releases RSS / page change heuristic
  2. NSE circulars headline match
  3. Hugging Face blog RSS
- Match = title/snippet regex or “new item since last poll”.
- Persist last-seen ids in SQLite `radar_state`.
- **PWA:** minimal `manifest.webmanifest` + empty SW registration hook so install works; **web-push delivery deferred to M6** (log trip + in-app 🔴 only in v3).

### Cost note (Radar)
- Polling: **$0** (HTTP GET to public RSS).
- Push: **$0 in v3** (no FCM/VAPID yet). Note for M6: web-push is infra cost only.

### Playwright
- Seeded trip → verdict contains Radar / tripwire name + level red.
- No trip → Radar CLEAR; quiet fixture still green.
- Manifest link present in document.

---

## Non-goals (v3)
- Full article reader / Infinite scroll of Briefs
- Instagram / TikTok
- Editable tripwire UI
- Production web-push (M6)

## Gate
Cumulative Playwright green + cost notes above in `GATE-V3-REPORT.md` + stop.
