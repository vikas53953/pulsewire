# PulseWire

Local hot-news highlights dashboard. Open it, scan in 30 seconds, close it.

[![e2e](https://github.com/vikas53953/pulsewire/actions/workflows/e2e.yml/badge.svg)](https://github.com/vikas53953/pulsewire/actions/workflows/e2e.yml)

## Quick start

```bash
cp .env.example .env.local
# Node 20–22 (see .nvmrc). better-sqlite3 needs node-gyp + Node headers.
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Automated gate (Playwright)

```bash
npm run test:e2e
```

Runs with `PW_TEST=1` (fixture feeds + stubbed LLM). Live-feed smoke is tagged `@live` and excluded from the default gate (`npm run test:e2e:live` or the nightly CI job).

Unit tests (verdict / rank / score):

```bash
npm run test:unit
```

### Optional LLM

Copy `.env.example` → `.env.local` and set `LLM_API_KEY`. Without it, raw-mode + merge still works (2 min retry TTL).

### Beta door (public URL)

Set `BETA_TOKEN` in the environment. Visitors open `/?key=<token>` once; an HttpOnly cookie unlocks the app. `?refresh=1` and manual X deep-refresh require the same token even if you later loosen the page gate. Leave `BETA_TOKEN` unset for local-only. **Never tunnel a process with `PW_TEST=1`** — test query params mutate server-global state for every visitor.

### Deploy target (read this)

PulseWire assumes **one long-lived Node process**:

- In-memory section cache (`globalThis` Map)
- Background warmer (`instrumentation` → 10-min loop)
- SQLite history + X governor on local disk

**Deploy to a persistent single instance** (Fly.io, Railway, a VPS with pm2/systemd). **Do not deploy to serverless** (Vercel/Netlify lambdas): cold starts empty the cache, the warmer never stays up, SQLite is ephemeral, and multiple instances split the X budget and double-fetch every feed. Horizontal scale requires moving cache + governor to Redis / shared SQLite first — until then, one instance is a feature.

### Baseline backup (the moat)

`data/pulsewire.db` is gitignored and cannot be regenerated quickly (60-day IST baselines). Snapshot it nightly or before deploys:

```bash
npm run backup:db
# cron: 15 2 * * * cd /path/to/pulsewire && npm run backup:db
# optional second disk: PULSEWIRE_BACKUP_DIR=/mnt/backups/pulsewire
# retention: keeps newest 14 (PULSEWIRE_BACKUP_KEEP); older snapshots deleted
```

### Ops health

`GET /api/health` — cache ages, last warm duration, X governor used/cap, LLM mode, DB basename + row count, usage counters (`devicesToday`, `opensToday`, `medianSessionMs7d`). Open without the beta cookie so a cron can curl it.

### Beta success (definition)

≥40% of beta users open PulseWire ≥4 mornings/week in week 3, and median session &lt; 60 seconds.

Measured via anonymous `pw_device` in localStorage → `/api/usage` open + `pagehide` session beacon → SQLite `usage` table. No accounts, no PII. Read the counters on `/api/health`.

### Docs

- `SPEC-pulsewire-hot-news-app.md` — product/tech spec
- `M3-design-brief-bento-zine.md` — locked UI contract
- `PROJECT-MAP.md` — plain-English file map
- `implementation-notes.md` — deviations and quiet choices
