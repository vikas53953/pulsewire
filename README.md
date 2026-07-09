# PulseWire

Local hot-news highlights dashboard. Open it, scan in 30 seconds, close it.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### M1 API check

[http://localhost:3000/api/highlights?section=markets&window=4h](http://localhost:3000/api/highlights?section=markets&window=4h)

Confirm:

1. `items[].publishedAt` are real ISO timestamps.
2. No item is older than 4 hours.
3. Response includes `stale` and `rawMode`.

See `SPEC-pulsewire-hot-news-app.md` and `PROJECT-MAP.md`.
