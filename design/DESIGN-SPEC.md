# PulseWire — SIGNAL BLACK (8d) · Design Spec

Locked from canvas frame **8d**: X-style three-column structure in PulseWire's own status language. Dark (pure black) is primary; light co-equal. `design/tokens.css` is the drop-in token file; `design/logo.svg` is the brand mark; `design/mockups/` is the visual source of truth (home-dark, home-light, states).

## 0. Concept

The familiar social skeleton — brand mark + icon rail + account block left, tabbed feed center, trending rail right — repurposed so every engagement mechanic becomes a status mechanic:
- **Desk tabs replace topic tabs.** `Today · Markets · India · Economy · Tech · Politics · Sports · World`, each tab carrying its live pulse score under the label. Active tab = 4px blue underline. One glance across the tab row answers "is anything loud?"
- **Pinned verdict** = white plate on black (always the brightest element, the heartbeat). **Posts** come *from sources* with an evidence row (`◉ pulse 61 · Economy · 2 sources agree`) instead of likes. **"You're all caught up"** ends every feed — the product promise.
- **Blue (#1D9BF0) is brand/action only** — logo, refresh pill, active-tab underline, verdict tag. It NEVER encodes status. Status is exclusively: quiet (muted grey), warming (amber), hot (vermilion-orange), unknown (achromatic + dashed), success (green).
- **Honesty states:** quiet-win = green-bordered plate + shorter feed; **status unknown out-shouts hot** — inverted white plate with 4px dashed alert border, `?` in tab scores, stale posts at 55% opacity, caught-up line becomes a warning; calibrating = `·c` suffix on tab scores + legend line.

## 1. Color (see tokens.css)

Dark: bg `#000000` · panel `#16181C` · line `#2F3336` · ink `#E7E9EA` · dim `#71767B` · accent `#1D9BF0` · quiet `#3E4144` · warm `#D9A83E` · hot `#F0764A` · success `#00BA7C` · verdict plate `#E7E9EA`/`#0A0A0A` · unknown plate inverted + alert `#C0361C`.
Light: bg `#FFFFFF` · panel `#F7F9F9` · line `#EFF3F4` · ink `#0F1419` · dim `#536471` · accent `#1D9BF0` · warm `#B98A2E` · hot `#C0361C` · success `#00825C` · verdict plate `#0F1419`/`#FFFFFF`.
Rules: no gradients; blue never means status; every status color pairs with a word or score, never color-alone.

## 2. Brand

Logo (`design/logo.svg`): 40×40 squircle (rx 10), heartbeat stroke `M6 20h8l3-8 6 16 3-8h8`, 3px round caps. Dark theme: `#E7E9EA` field / black stroke; light: `#0F1419` field / white stroke; standalone/app-icon: `#1D9BF0` field / white stroke. Wordmark: `PulseWire`, Archivo 800, tracking .03em, always right of the mark, 12px gap.

## 3. Type & spacing

Archivo (400–800) UI; Spline Sans Mono (400–600) for every number/timestamp/tag (tabular). Scale: verdict 25/600/1.32 · post headline 19/500/1.4 · nav 18/500 (700 active) · tab 15/500 (700 active) + 11 mono score · source 15/600 · meta 13 mono · tags 12 mono ls .08em · caught-up 16/600. 4px grid; card radius 16, chips 12, pills 999; targets ≥44px. Columns: `290px / minmax(0,740px) / 1fr`, max 1560px. ≤1250px: rail collapses to 88px icons (refresh pill becomes ↻ circle); ≤767px: single column, top bar, tabs compress (12px), no horizontal scroll.

## 4. Components (repo mapping)

- **Rail** (`Header.tsx` → SideNav): brand block; items Today/Desks/Trend/History/Settings (48px rows, pill hover in panel color); blue **Refresh now** pill (50px, white text); account block bottom (42px avatar, name 15/600, mono meta `new delhi · 07:41 IST`).
- **Desk tabs** (`ScoreChips.tsx` → DeskTabs): equal-width, 56px tall, label + mono score. Score color = status (dim when quiet). Active = ink + inset 4px blue underline. States: unknown `?`; calibrating `{score}·c` + legend line under tabs. Tab click filters feed to that desk.
- **Verdict plate** (`VerdictHero.tsx`): radius 16, padding 24×28; tag 12 mono blue `VERDICT · PINNED · {time}`; body 25/600; optional mono watch-line. Hot: bg `--pw-hot`, black text. Quiet-win: `--pw-win-bg` + 2px solid success border, ☕ allowed. Unknown: inverted plate + 4px dashed `--pw-unk-alert` border, tag `⚠ STATUS UNKNOWN — NOT QUIET · VERDICT WITHHELD`.
- **Post card** (`BentoGrid.tsx`/`HighlightTile.tsx`): panel bg, 1px line border, radius 16; avatar initials 36px + source + mono meta; headline; evidence row `◉ pulse N` (status color) · desk · `N sources agree`. Cap 8, never padded. Stale: opacity .55, meta `as of {time}`.
- **Caught-up line**: always present. Normal/quiet-win in success; hot variant in dim; unknown variant in hot: `⚠ Cannot confirm you're caught up — feeds down. Do not read silence as quiet.`
- **Right rail** (`VibePanel.tsx` + new Leaderboard): "Trending off-platform" card (dashed 1.5px items = unverified texture; designed empty + unreachable states) and "Desk leaderboard" card (rows: name, 5px bar width=score colored by status, mono score; sorted desc).

## 5. Motion & a11y
Refresh: verdict + changed tab scores dip opacity 150ms; new posts fade/4px rise, 200ms stagger 40ms. No shimmer. `prefers-reduced-motion`: none. Focus: 2px `--pw-accent` outline offset 2. `lang="en-IN"`, IST everywhere. theme-color `#FFFFFF`/`#000000`.
