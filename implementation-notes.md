# Implementation notes

## Feed swaps (M1)

| Spec source | Status | Action |
|---|---|---|
| Business Standard Economy RSS | HTTP 403 (Access Denied) from this environment | Replaced with **The Hindu Business Line** economy feed: `https://www.thehindubusinessline.com/economy/?service=rss` |
| Hindustan Times India | Spec said "Hindustan Times India" | Using HT India News feed: `https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml` (alive) |
| Google News World / Tech | Spec requested India edition | Using `hl=en-IN&gl=IN&ceid=IN:en` topic RSS URLs (alive) |

All other configured feeds returned HTTP 200 with parseable RSS/Atom at M1 build time.

## M1 scope

- API returns **raw titles** (`rawMode: true`) — LLM summarizer/dedupe arrives in M2.
- Cache uses raw-mode short TTL (`RAW_CACHE_TTL_MINUTES`, default 2) until LLM path lands.
- `export const dynamic = 'force-dynamic'` on `/api/highlights` so Next.js does not freeze responses.
- Default section when omitted: `all`. Default window when omitted: `4h`.
- Manual bypass: `?refresh=1`.
