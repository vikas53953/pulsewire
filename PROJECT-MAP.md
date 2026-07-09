# PulseWire project map (plain English)

- `app/` — Next.js App Router pages and API routes the browser hits.
- `app/page.tsx` — Temporary M1 landing page with a link to the highlights API.
- `app/layout.tsx` — Shared HTML shell, fonts, and dark theme defaults.
- `app/globals.css` — Global styles and Tailwind layers.
- `app/api/highlights/route.ts` — `GET /api/highlights` (force-dynamic). Returns hot highlights JSON for a section + time window.
- `lib/feeds.config.ts` — Curated breaking/top-story RSS URLs grouped by section. Edit feeds here.
- `lib/feed-engine.ts` — Fetches RSS in parallel (8s timeout), parses items, keeps only last 24h.
- `lib/highlights.ts` — Builds the API payload: cache lookup, refresh, window slice, cap.
- `lib/cache.ts` — In-memory Map cache with dual TTL (10m normal / ~2m raw-mode).
- `lib/types.ts` — Shared TypeScript types for sections, windows, and API shapes.
- `.env.example` — Env var names (no secrets). Copy to `.env.local` for LLM in M2.
- `SPEC-pulsewire-hot-news-app.md` — Product/tech spec this build follows.
- `implementation-notes.md` — Deviations from the spec (feed swaps, etc.).
- `PROJECT-MAP.md` — This file.
