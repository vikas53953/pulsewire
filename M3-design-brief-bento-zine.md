# M3 DESIGN BRIEF — PulseWire "Bento Zine" (LOCKED)

**Status:** Approved by Vikas 2026-07-09. This is the visual contract for M3.
Do not freestyle. Where this brief is silent, choose the quietest option and log it in `implementation-notes.md`.
A reference mock exists (`pulsewire-design-directions.html`, Direction C) — match its feel, not pixel-perfection.

---

## 1. Concept in one line

A bento grid where **hotness = tile size**: the biggest tile IS the biggest story. Zine/sticker energy — hard borders, hard shadows, loud accent tiles — on a calm paper background. Scannable in 10 seconds without reading.

## 2. Design tokens (implement as CSS variables / Tailwind theme)

```css
--paper:   #ECEADF;  /* page background (light default) */
--ink:     #141414;  /* text, borders, shadows */
--card:    #FFFFFF;  /* normal tile */
--mega:    #FF4D4D;  /* hottest-story tile bg (white text) */
--teal:    #BDF3E6;  /* secondary hot tile */
--lav:     #E4DCFF;  /* tertiary accent tile */
--sticker: #FFD23F;  /* badge/sticker + active tab */
```

**Dark mode ("Night Zine", via toggle — light is DEFAULT):** invert paper/ink → `--paper:#141414`, `--ink:#ECEADF`, `--card:#1E1E1E`; keep `--mega/--teal/--lav/--sticker` unchanged (they pop harder on dark). Shadows become `4px 4px 0 #000`.
*Note: this intentionally overrides SPEC §9 "dark default" — approved deviation, log it.*

**Type:** system stack (`system-ui, -apple-system, Segoe UI, Roboto`). Personality comes from weight + case, not webfonts (perf):
- Logo: 900 weight, -0.05em tracking, UPPERCASE, "Wire" reversed (ink bg, paper text, -2° rotate)
- Mega tile headline: 24px / 900 / 1.15 line-height
- Normal tile headline: 14px / 800 / 1.3
- Meta rows: 10px / 700 / UPPERCASE / .08em tracking / 75% opacity
- Tabs: 12px / 900 / UPPERCASE

**Surfaces:** every tile: `border: 2px solid var(--ink); border-radius: 16px; box-shadow: 4px 4px 0 var(--ink)`. Press state: translate(2px,2px) + shadow 1px 1px (the "press-down" feel). Transition 120ms.

## 3. Layout

```
┌──────────────────────────────────┐
│ PULSE[WIRE]        [1h|4h|12h|24h]│  header: logo + window segmented control
│ (⚡All)(India)(Markets)(Economy).. │  tab row: pill tabs, horizontal scroll
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ MEGA TILE (full width, red)  │ │  hottest story (most sources, then newest)
│ │  🔥 N SOURCES sticker        │ │
│ └──────────────────────────────┘ │
│ ┌───────────┐ ┌───────────┐     │
│ │ teal tile │ │ white tile│     │  2-col grid below
│ └───────────┘ └───────────┘     │
│ ┌───────────┐ ┌───────────┐     │
│ │ lav tile  │ │ white tile│     │
│ └───────────┘ └───────────┘     │
├──────────────────────────────────┤
│ updated 3 min ago · auto 10m · ↻ │  footer strip
└──────────────────────────────────┘
```

**Tile assignment algorithm (deterministic, no randomness):**
1. Sort section items: merged-🔥 first (by source count desc), then by recency.
2. Item #1 → **mega** tile (full width, `--mega` bg, white text, sticker badge "🔥 N SOURCES"). If no merged story exists, the newest item is mega WITHOUT the sticker.
3. Items #2 and #3 → `--teal` and `--lav` tiles if they are 🔥-merged, else `--card` white.
4. All remaining → white `--card` tiles.
5. Grid: mega spans both columns; everything else 2-col (1-col under 360px width).

**Sticker badge:** absolutely positioned, top:-10px right:10px, `--sticker` bg, 2px ink border, 4° rotate, 10px/900. Variants: `🔥 N SOURCES` (merged), `RAW` (rawMode), `STALE` (stale data).

## 4. Components

| Component | Behavior |
|---|---|
| **Window control** | Segmented 1h/4h/12h/24h, 2px ink border, active segment = ink bg + paper text. Switching re-slices from cached pool — no full reload. |
| **Tabs** | Pills with 2px ink border; active = `--sticker` bg + 3px 3px 0 ink shadow. Horizontal scroll, no scrollbar. ⚡ All is default. |
| **Tile** | Whole tile is an `<a>` → original article, `target="_blank" rel="noopener"`. Meta row: source name(s) ("Moneycontrol +3"), relative age ("22m ago"), section name (only on the All tab). |
| **Footer strip** | "updated Xm ago · auto-refresh 10 min" + ↻ button (calls `?refresh=1`). Centered, 11px/700/UPPERCASE. |
| **Theme toggle** | Small ◐ button in header, persists in localStorage, respects `prefers-color-scheme` on first load only. |

## 5. States (all mandatory — SPEC §9/§11 mapped to this skin)

| State | Treatment |
|---|---|
| **Loading** | Skeleton bento: 1 mega + 4 small gray tiles, ink borders, shimmering paper-tone fill. Never a blank page or lone spinner. |
| **Empty (quiet hour)** | One centered white tile: "QUIET HOUR 😴 — nothing hot in the last 1h." + sticker-style button "TRY 4H" that switches the window. |
| **Stale** | Thin full-width strip above grid, `--sticker` bg, ink text: "⚠ SHOWING LAST-KNOWN NEWS — SOURCES UNREACHABLE". Driven by `stale: true`. Every tile also gets small STALE sticker? No — strip only (one signal, not twenty). |
| **Raw mode** | Small `RAW` sticker on the header (not per-tile), driven by `rawMode: true`. Tiles show trimmed titles as normal. |
| **Error tile** | If a single item lacks a URL, tile renders non-clickable with 60% opacity. |

## 6. Motion (restraint)

- Tile press-down (transform+shadow, 120ms) — the ONLY per-element animation.
- On data refresh: new tiles fade in 200ms. No slide, no bounce, no stagger.
- `prefers-reduced-motion: reduce` → disable both.

## 7. Responsive

- Mobile-first. ≥768px: grid becomes 3-col, mega spans all 3, max-width 1080px centered.
- <360px: single column, mega keeps full width.
- Tap targets ≥44px. Tabs and window control must be thumb-reachable (they're at top — acceptable since footer refresh exists; do NOT add a bottom dock, that's Direction B).

## 8. Accessibility floor

- Visible keyboard focus: 3px `--sticker` outline offset 2px on tiles/tabs/buttons.
- Mega tile red (#FF4D4D) with white text passes AA at 900 weight/24px — do not lighten the red.
- All meaning carried by color (teal/lav) is decorative only — hotness is already in size + sticker text.

## 9. M3 exit checklist (gate before M4)

- [ ] Every tab × every window renders the bento correctly
- [ ] Mega tile is always the top merged/newest story; sticker math correct
- [ ] Loading / empty / stale / raw states each demonstrable on demand
- [ ] Light default + Night Zine toggle persists across reloads
- [ ] Mobile 360px and desktop 1080px both clean (screenshots as evidence)
- [ ] Whole-tile links open originals in new tab
- [ ] `PROJECT-MAP.md` updated with components/ entries in plain words
