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

### BUG-1 — slow tabs / stale tiles
- Background warmer (`instrumentation.ts` + `lib/warmer.ts`) warms **all sections** on boot and every `CACHE_TTL_MINUTES`.
- Client clears tiles immediately on tab change, keys `BentoGrid` by `section|window`, and keeps an in-memory per-section/window response cache for instant back-navigation.
- Never paints Section A under Section B’s active tab.

### BUG-2 — identical 1h/4h/12h/24h
- Cache stores a deep **24h pool** (`POOL_CAP=80`); window filter + cap run at request time via `rankAndCapForWindow`.
- Merged highlights keep the **earliest** source `publishedAt` (not newest / not `generatedAt`).
- Sort priority inside a window: 🔥 source-count desc → then recency.
- Wider windows reserve up to 3 slots for stories older than the previous tier so a busy 1h burst cannot hide the rest of the day when no 🔥 merges exist.
- Per-feed cap raised 12 → 30 so older items survive into the pool.
- `?refresh=1` clears cache and logs `[pulsewire] cache-miss …` on the server.

### Quiet M4 choices
- Warmer also started from the API route as a safety net if instrumentation is late.
- In-flight refresh de-duped per section via `setRefreshing` so boot warm + first request don’t double-fetch.

## Deferred (v1.1 — not built)
- NEW stickers since last visit (localStorage)
- WhatsApp share on tiles
- PWA install + offline last bento
- 60-second brief / swipe cards
- ⚡ X Pulse via Grok Live Search (with hard monthly cap)
