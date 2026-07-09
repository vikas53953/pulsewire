# Fixture feeds (PW_TEST=1)

When `PW_TEST=1`, the feed engine serves deterministic in-memory items from
`lib/test-mode.ts` (not live RSS). Ages are relative to `Date.now()`:

| Age | Purpose |
|---|---|
| 10m, 50m | Appear in 1h window |
| 3h | Appears in 4h+ |
| 9h (duplicate title on Fixture A + B) | Merge → 🔥; surfaces in 12h/24h |
| 20h | Appears only in 24h |
| minors ~12–19m | Cap-10 ranking pressure |

Sample XML in this folder documents the contract for humans. Runtime does not
parse these files — it uses `fixtureItemsForSection()`.

Test-only query params (ignored unless `PW_TEST=1`):

- `?pwLlmFail=1` — force LLM stub failure → `rawMode: true`
- `?pwFeedsDown=1` — empty pool + `sourcesUnreachable`
- `?pwEmpty=1` — empty items (quiet hour)
- `?refresh=1` — cache bust; response includes `cacheMiss: true` + `X-PulseWire-Cache: MISS`
