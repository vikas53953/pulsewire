# SPEC — "PulseWire" Hot-News Highlights App (v1, Local)

**Owner:** Vikas (product owner, non-coder — explain in plain words, no jargon walls)
**Builder:** Grok 4.5
**Date:** 2026-07-09
**Status:** Approved for build — Phase 1 (local). Vercel deployment is Phase 2 (do NOT build now, but don't block it architecturally).

---

## 1. One-line summary

A browser dashboard, running locally on Windows, that shows **only breaking / high-attention news** as one-line highlights, grouped by section (India, Markets, Economy, Politics, Sports, World, Tech), filterable by time window (last 1h / 4h / 12h / 24h). No full articles. No noise. Open it, scan in 30 seconds, close it.

## 2. Goals and non-goals

**Goals**
1. Instant answer to "did anything big happen in the last N hours?"
2. Only hot news: items come exclusively from curated breaking/top-story feeds (source-based hotness — the feed IS the filter).
3. Highlights, not detail: each item = one tight sentence (max ~20 words) + source name + timestamp + link to original.
4. Section tabs + time-window pills. Both filters combine (e.g., Markets + last 4h).
5. Runs locally with one command (`npm run dev`), opens in the browser.

**Non-goals (v1)**
- No full-article reading inside the app (link out only).
- No user accounts, no personalization, no notifications, no mobile app.
- No LLM-based hotness scoring (LLM is summarizer/deduper ONLY).
- No database — in-memory cache with periodic refresh is enough.
- No Vercel deployment yet.

## 3. Tech stack (mechanical decisions — already made, don't re-ask)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Runs locally now; deploys to Vercel later with zero rework |
| Language | TypeScript | Fewer runtime surprises |
| UI | React + Tailwind CSS | Fast, clean, no design system needed |
| RSS parsing | `rss-parser` npm package | Battle-tested |
| LLM | xAI Grok API via `fetch`, model + endpoint + key in `.env.local` | Provider-swappable: `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` |
| Cache | In-memory (module-level Map) with timestamp | No DB needed for v1 |
| Target machine | Windows local (Node 20+) | Vikas's default environment |

## 4. Architecture (plain words)

```
Browser (React UI)
   │  GET /api/highlights?section=markets&window=4h
   ▼
Next.js API route (the "kitchen")
   │  1. Check cache (fresh if < 10 min old) → serve instantly
   │  2. If stale: fetch all RSS feeds for that section in parallel
   │  3. Keep only items published inside the max window (24h)
   │  4. Send raw headlines to LLM in ONE batched call →
   │     dedupe + rewrite as one-line highlights + tag importance
   │  5. Cache result, return JSON
   ▼
Curated RSS feeds (the "hot sources")
```

**Key rule:** one LLM call per refresh cycle per section batch — never one call per headline (cost + speed).

## 5. Sections and feed list (v1 — editable in one config file `feeds.config.ts`)

Every feed below is a **breaking / top-stories** feed on purpose. Do not add general firehose feeds.

| Section | Feeds (RSS URLs — verify each is alive at build time; replace dead ones with equivalent top-story feeds and note the swap in `implementation-notes.md`) |
|---|---|
| **India** | NDTV Top Stories; Times of India Top Stories; Hindustan Times India; The Hindu National |
| **Markets** | Moneycontrol Top News; Economic Times Markets; Livemint Markets |
| **Economy** | Economic Times Economy; Business Standard Economy; Livemint Economy |
| **Politics** | The Hindu National (politics-tagged); Indian Express Politics; NDTV India-News |
| **Sports** | ESPNcricinfo (India); Times of India Sports; NDTV Sports |
| **World** | BBC World; Al Jazeera; Google News "World" topic RSS (India edition, `hl=en-IN&gl=IN`) |
| **Tech/AI** | TechCrunch; The Verge; Google News "Technology" topic RSS (India edition) |
| **⚡ All / Breaking** (default tab) | Union of the top 3–5 hottest items from every section |

Config file shape:
```ts
export const FEEDS = [
  { section: "markets", name: "Moneycontrol", url: "https://...", weight: 1 },
  ...
];
```

## 6. Hotness + dedupe logic

1. **Hotness = source-based.** If an item is in one of these feeds and inside the time window, it qualifies. No scoring model.
2. **Cross-feed boost:** if 2+ feeds in a section carry the same story (fuzzy title match ≥ 0.6 similarity, or LLM marks them duplicates), merge into ONE highlight and pin it to the top with a 🔥 badge and "covered by N sources".
3. **Recency sort** within each section after the pinned items.
4. **Cap:** max 10 highlights per section per window. If more qualify, keep the 🔥 merged ones + most recent.

## 7. LLM contract (summarizer/deduper only)

**One batched request per section refresh.** Input: JSON array of `{id, title, snippet, source, publishedAt}`. Output: strict JSON only (instruct: no markdown fences, no preamble).

System prompt (use verbatim, tune only if output breaks):
```
You are a wire-desk editor. You receive raw news items. Return ONLY valid JSON:
{ "highlights": [ { "ids": [merged item ids], "text": "<one factual sentence, max 20 words, no opinion, no clickbait>", "merged": true|false } ] }
Rules: merge items that describe the same event; never invent facts not present
in the input; keep numbers and names exact; write in neutral English.
```

**Failure fallback:** if the LLM call fails or returns unparseable JSON → show raw feed titles (trimmed to 110 chars) with a small "raw mode" badge. The app must NEVER show an empty screen because the LLM is down.

## 8. API design

`GET /api/highlights?section=<all|india|markets|economy|politics|sports|world|tech>&window=<1h|4h|12h|24h>`

Response:
```json
{
  "section": "markets",
  "window": "4h",
  "generatedAt": "2026-07-09T10:32:00Z",
  "stale": false,
  "items": [
    {
      "text": "Sensex falls 900 points as RBI holds rates; banking stocks lead losses.",
      "sources": [{ "name": "Moneycontrol", "url": "https://..." }],
      "publishedAt": "2026-07-09T09:58:00Z",
      "hot": true
    }
  ]
}
```

- Cache TTL: **10 minutes** per section. Serve stale instantly + refresh in background (stale-while-revalidate) so the UI never waits more than ~200ms on a warm cache.
- Time-window filtering happens at request time from the cached 24h pool (fetch once, slice many).

## 9. UI spec

Single page. Dark theme default (terminal / Bloomberg feel), light toggle.

```
┌────────────────────────────────────────────────┐
│ ⚡ PulseWire        [1h] [4h] [12h] [24h]  🌙  │
│ [All] [India] [Markets] [Economy] [Politics]   │
│ [Sports] [World] [Tech]                        │
├────────────────────────────────────────────────┤
│ 🔥 Sensex falls 900 pts as RBI holds rates     │
│    Moneycontrol · ET · 34 min ago              │
│ •  Govt announces PLI scheme expansion...      │
│    Livemint · 1h ago                           │
│ ...                                            │
├────────────────────────────────────────────────┤
│ Updated 3 min ago · auto-refresh 10 min  [↻]   │
└────────────────────────────────────────────────┘
```

Rules:
- Each highlight row: one line of text (truncate with ellipsis, full text on hover), source name(s), relative time ("34 min ago"), whole row clicks through to the original article in a new tab.
- 🔥 badge = multi-source merged story, pinned top.
- Active time pill and section tab visually obvious.
- Empty state (nothing in window): "Quiet hour — nothing hot in the last 1h. Try 4h." (button switches window).
- Loading state: skeleton rows, never a spinner-only blank page.
- Auto-refresh every 10 min while tab is open; manual ↻ button forces bypass of cache.
- Responsive: usable at mobile width (tabs scroll horizontally).

## 10. Config & env (`.env.local`)

```
LLM_PROVIDER=xai
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=...
LLM_MODEL=grok-4.5
CACHE_TTL_MINUTES=10
MAX_ITEMS_PER_SECTION=10
```

## 11. Error handling (must-haves)

| Failure | Behavior |
|---|---|
| One feed times out (>8s) | Skip it, log to console, serve the rest — never block the section |
| All feeds in a section fail | Show section with "sources unreachable" banner + last cached data marked `stale: true` |
| LLM fails / bad JSON | Raw-mode fallback (section 7) |
| Feed returns malformed XML | Skip feed, log, continue |

## 12. Build milestones (build and verify in this order)

1. **M1 — Feed engine:** fetch + parse all configured feeds, time-window filter, JSON out via API route. *Verify: hit the API in browser, see real items with correct timestamps.*
2. **M2 — LLM layer:** batched summarize + dedupe + fallback path. *Verify: kill the API key, confirm raw mode still renders.*
3. **M3 — UI:** tabs, pills, rows, states, auto-refresh. *Verify: every tab × every window renders; empty and error states shown deliberately.*
4. **M4 — Polish:** cache TTL, stale-while-revalidate, mobile width, dark/light.

After each milestone, produce a short report: DONE / file paths / how to test it in 3 steps.

## 13. Acceptance criteria (definition of done)

- [ ] `npm run dev` on Windows → app on `localhost:3000`, no manual steps beyond `.env.local`.
- [ ] Every section × every window combination returns within 2s on warm cache.
- [ ] No item older than the selected window ever appears.
- [ ] Duplicate stories across feeds appear as ONE merged 🔥 item.
- [ ] LLM outage does not blank the app (raw mode works).
- [ ] Every highlight links to its original article.
- [ ] `PROJECT-MAP.md` exists at repo root: one plain-English line per folder/key file.
- [ ] Any deviation from this spec logged in `implementation-notes.md` (what changed, why).

## 14. Phase 2 preview (do NOT build now)

Vercel deployment: swap in-memory cache for Vercel KV or `unstable_cache`, add cron-triggered refresh (Vercel Cron), env vars via dashboard. The Next.js choice makes this a config task, not a rewrite.
