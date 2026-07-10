# PulseWire

Local hot-news highlights dashboard. Open it, scan in 30 seconds, close it.

[![e2e](https://github.com/vikas53953/pulsewire/actions/workflows/e2e.yml/badge.svg)](https://github.com/vikas53953/pulsewire/actions/workflows/e2e.yml)

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Automated gate (Playwright)

```bash
npm run test:e2e
```

Runs with `PW_TEST=1` (fixture feeds + stubbed LLM). Live-feed smoke is tagged `@live` and excluded from the default gate.

### Optional LLM

Copy `.env.example` → `.env.local` and set `LLM_API_KEY`. Without it, raw-mode + merge still works (2 min retry TTL).

### Docs

- `SPEC-pulsewire-hot-news-app.md` — product/tech spec
- `M3-design-brief-bento-zine.md` — locked UI contract
- `PROJECT-MAP.md` — plain-English file map
- `implementation-notes.md` — deviations and quiet choices
