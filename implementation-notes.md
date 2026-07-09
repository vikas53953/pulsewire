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

## Not yet

- M3 UI (waiting on locked design mock — do not freestyle)
- M4 polish pass
