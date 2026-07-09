# PulseWire

Local hot-news highlights dashboard. Open it, scan in 30 seconds, close it.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Check data (readable)

Open [http://localhost:3000/](http://localhost:3000/) — Markets 4h list with timestamps and 🔥 merges.

API: [http://localhost:3000/api/highlights?section=markets&window=4h](http://localhost:3000/api/highlights?section=markets&window=4h)

For LLM summaries (optional in M2): copy `.env.example` → `.env.local` and set `LLM_API_KEY`. Without it, raw-mode + merge still works (2 min retry TTL).

See `SPEC-pulsewire-hot-news-app.md` and `PROJECT-MAP.md`.
