# PulseWire project map (plain English)

- `app/` — Next.js App Router pages and API routes the browser hits.
- `app/page.tsx` — Temporary M1/M2 proof page (Markets 4h list + gate banner). Real UI is M3 after design lock.
- `app/layout.tsx` — Shared HTML shell, fonts, and dark theme defaults.
- `app/globals.css` — Global styles and Tailwind layers.
- `app/api/highlights/route.ts` — `GET /api/highlights` (force-dynamic). Returns hot highlights JSON for a section + time window.
- `lib/feeds.config.ts` — Hybrid feeds: Google News India-edition topic/search + direct top-story RSS per section.
- `lib/feed-engine.ts` — Fetches RSS in parallel (8s timeout), parses items, keeps last 24h, resolves Google redirect URLs when possible.
- `lib/resolve-url.ts` — Best-effort Google News → publisher URL resolver (falls back to Google link).
- `lib/similarity.ts` — Fuzzy title similarity (≥0.6) for cross-feed duplicate detection.
- `lib/merge.ts` — Clusters duplicates, pins 🔥 multi-source stories, maps LLM output back to sources.
- `lib/llm.ts` — One batched Grok call per section (summarize + dedupe); raw-mode on failure.
- `lib/highlights.ts` — Orchestrates fetch → merge → LLM → cache → window slice.
- `lib/cache.ts` — In-memory Map cache with dual TTL (10m LLM / ~2m raw-mode).
- `lib/types.ts` — Shared TypeScript types for sections, windows, and API shapes.
- `.env.example` — Env var names (no secrets). Copy to `.env.local` for LLM.
- `SPEC-pulsewire-hot-news-app.md` — Product/tech spec this build follows.
- `implementation-notes.md` — Deviations from the spec (feed swaps, etc.).
- `PROJECT-MAP.md` — This file.
