# PulseWire

Local hot-news highlights dashboard. Open it, scan in 30 seconds, close it.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional LLM

Copy `.env.example` → `.env.local` and set `LLM_API_KEY`. Without it, raw-mode + merge still works (2 min retry TTL).

### Docs

- `SPEC-pulsewire-hot-news-app.md` — product/tech spec
- `M3-design-brief-bento-zine.md` — locked UI contract
- `PROJECT-MAP.md` — plain-English file map
- `implementation-notes.md` — deviations and quiet choices
