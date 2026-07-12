# PulseWire — WIRE DESK · Design Spec (design/claude-design-v1)

**Contract for implementation.** Replaces the "Bento Zine" visual system. Every value here is exact; where a component has states, every state is specified. Mockups in `design/mockups/` are the visual source of truth; this file is the numeric one.

---

## 0. Concept — where this comes from (rationale)

PulseWire is not a feed; it is a **status instrument read once per morning**. The identity is assembled from the product's own ancestors, not from dashboard templates:

1. **Indian broadsheet masthead** — the page opens like a newspaper front: heavy 5px ink rule, letterspaced nameplate, a dateline folio ("NEW DELHI EDITION · FRI 11 JUL 2026 · 07:42 IST") between a thin and a thick rule. This is where "trustworthy news" lives in Indian visual memory. No cream, no serif — the authority is carried by *rules and structure*, not paper texture.
2. **Wire-service tape** — stories are agency wire items: a monospace time-slug line (`07:12 IST · ECO · REUTERS +5`) above a condensed headline. The board terminates in an explicit sign-off: `— END OF WIRE · 6 ITEMS · NOTHING HELD BACK —` (the teletype "-30-"). This is how a capped list of 3 items reads as a **closed edition**, not a starved feed.
3. **Departure board / instrument panel** — the seven desks are seven fixed rows in strict columns: code, tick meter, tabular-numeral score, status word. One saccade down the score column answers "is anything loud?" The meter is a row of ten discrete ticks (▮▮▮▮▮▮▯▯▯▯) — a VU/signal meter, deliberately not a continuous progress bar.
4. **Type = IBM Plex** (Sans Condensed + Mono) — Plex descends from IBM's terminal and instrument lineage; condensed grotesque for verdicts/headlines gives newsprint-headline economy at small widths. It is not Inter/Space Grotesk, and the mono is structural (timestamps, scores, attribution = the *evidence layer*), never decorative.
5. **Color = status only.** Four meanings: calm green, warming ochre, hot vermilion, and UNKNOWN — which is **achromatic, inverted and hazard-striped**, so it out-shouts hot without stealing red. Quiet is rewarded with **brevity**: on an all-quiet morning the page itself gets shorter (verdict plate + board + closed-wire line, nothing else).

Anti-goals honored: no cream+serif, no neon-accent dark mode, no hairline-only minimalism (rules come in 1/3/5px weights), no bento, no rounded pastel cards (radius is 0 globally), no emoji glyphs in UI (traffic-light emoji in ScoreChips are removed; status words + color replace them), nothing centered except the END OF WIRE sign-off.

---

## 1. Color tokens

See `design/tokens.css` (drop-in). Summary:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--pw-paper` | `#F4F5F2` | `#0E120F` | page bg |
| `--pw-ink` | `#17191B` | `#E9EBE3` | text, strong rules |
| `--pw-ink-dim` | `#565B5E` | `#8F968D` | slugs, meta, legends |
| `--pw-rule` | `#C6CAC6` | `#2B312C` | 1px row rules, meter-off ticks |
| `--pw-calm` | `#1F7A44` | `#52C97E` | quiet 0–39 |
| `--pw-warm` | `#9A6A00` | `#E0A63C` | warming 40–69 |
| `--pw-hot` | `#C0361C` | `#FF6A45` | hot 70–100 |
| `--pw-unknown-bg/fg` | ink/paper | paper/ground | inverted UNKNOWN plates |

Hard rules: no gradients except the UNKNOWN hazard stripe; no hue anywhere except via the four status tokens; `--pw-warm` on light is dark ochre `#9A6A00` (AA on paper), never bright yellow. Contrast: all status-on-paper pairs ≥ 4.5:1 at their sizes.

## 2. Typography

- **Display:** `'IBM Plex Sans Condensed', 'Arial Narrow', 'Helvetica Neue Condensed', sans-serif` — weights 600, 700 only.
- **Mono:** `'IBM Plex Mono', 'SF Mono', Consolas, monospace` — weights 400, 500, 600. Always `font-variant-numeric: tabular-nums` for scores/times.
- Load via Google Fonts (`display=swap`), subset latin.

Scale (px / weight / face / line-height / tracking):
- Verdict sentence — 27 / 700 / display / 1.16 / normal (24px below 380px width)
- Quiet & Unknown plate word — 40 and 32 / 700 / display / 1.05 / 0.04–0.06em
- Masthead — 24 / 700 / display / 1 / 0.10em
- Wire headline — 16 / 600 / display / 1.3
- Section labels (DESK BOARD, THE WIRE, TREND) — 13 / 700 / display / 1 / 0.12em, uppercase
- Desk score — 16 / 600 / mono, tabular
- Desk code — 15 / 700 / display / 0.05em
- Body mono (watch-line, honesty notes) — 12 / 400 / mono / 1.55
- Slug — 10 / 500 / mono / 0.10em, uppercase
- Micro (legends, status words, END OF WIRE) — 9 / 500–600 / mono / 0.12–0.16em, uppercase

All text left-aligned. `text-wrap: pretty` on verdict and headlines.

## 3. Spacing & structure

4px grid; page gutter 16px (360–430px), 24px ≥ 768px. Content max-width 680px single column at all sizes — the instrument stays one column even on desktop (≥1024px: center column, canvas `--pw-paper`; no multi-column dashboard). Touch targets ≥ 44px (`--pw-tap`). Row min-height 44px on desk rows; wire rows padding 10px 0.

**Rule grammar (replaces card chrome):** zones are separated by rules, never boxes/shadows: 5px page-top rule → masthead → 1px + 3px folio rules → verdict zone → 3px close → desk board (1px internal rows, 3px close) → wire (1px rows) → END OF WIRE line → TREND (1px *dashed* box — the only boxed element, marking lower-trust signal) → 3px rule → status bar.

## 4. Components

### 4.1 Masthead (`Header.tsx`)
Page-top 5px solid `--pw-ink` rule. Row: `PULSEWIRE` nameplate (24/700 display, 0.10em) left; theme toggle right — 44×44px, 1px ink border, glyph ◐/◑ (chars, not emoji). Below: folio line between 1px top rule and 3px bottom rule, padding 6px 0: left `NEW DELHI EDITION` (10 mono 500, dim), right `FRI 11 JUL 2026 · 07:42 IST` (ink). The date/time is live IST. RAW-mode: append ` · RAW` to the right slug in `--pw-ink-dim` (sticker removed).

### 4.2 Lens toggle (`LensToggle.tsx` / `TimePills.tsx`)
Segmented, 1px ink border, two cells min-height 44px: `SINCE YOU LEFT · 3H` / `WINDOWS` (10 mono 600, 0.10em). Active cell = inverted (ink bg, paper text). Windows lens expands a second identical row of 4 cells `1H 4H 12H 24H`. No pills, no radius.

### 4.3 Verdict hero (`VerdictHero.tsx`) — the heartbeat
Zone padding 18px 16px 20px, closed by 3px rule.
- **Status stamp** (above sentence): uppercase 10 mono 600, 0.16em, padding 5px 9px. Levels: MOSTLY QUIET / ALL QUIET → 1.5px border in `--pw-calm` or `--pw-warm`, text same color, transparent bg. HOT → solid `--pw-hot` bg, `--pw-paper` text (light) / `#0E120F` (dark) — the only filled color plate in the system.
- **Sentence:** 27/700 display, ink. Section names and counts are plain text (LLM/template output as-is).
- **Watch-line** (optional): 12 mono 400 dim, prefix `WATCH — `.
- **Quiet win state:** replace stamp+sentence with the bordered plate: 2px solid `--pw-calm` box, padding 22px 18px, containing `ALL QUIET` (40/700, calm), sub-sentence (21/700 display, ink) e.g. "Nothing needs you today. Closing this tab is the product working.", then `TOP OF THE QUIET — {headline} ({src} · {time} IST)` (12 mono dim). Below the desk board, the wire is REPLACED by the closed-wire line: centered rule-flanked `WIRE CLOSED 08:05 IST · SEE YOU TOMORROW` (9 mono, 0.18em). TREND collapses to its one-line no-surge form. Quiet = fewer elements, never placeholders.
- **Status unknown state:** replace hero with hazard plate: outer 7px padding filled with `--pw-hazard` stripes; inner solid `--pw-unknown-bg` plate, `--pw-unknown-fg`… inverted: on light = ink plate/paper text, on dark = paper plate/ink text. Contents: `STATUS UNKNOWN` (32/700), `NOT QUIET — VERDICT WITHHELD` (11 mono 600, 0.16em), body 12 mono: `{n} of 7 feeds unreachable since {time} IST. Absence of signal is not calm. Retrying every 60 seconds.` This plate must be visually louder than HOT (it is: inversion + stripes beat any hue). Never render a green/quiet verdict while feeds are down.

### 4.4 Desk board (`ScoreChips.tsx` → rows, not chips)
Section header row: `DESK BOARD` (13/700 display) left, legend `PULSE 0–100 VS NORMAL HOUR` (9 mono dim) right. Seven rows, min-height 44px, 1px `--pw-rule` between, 3px ink rule closing the block. Row grid, left→right:
1. Desk code — 46px col, 15/700 display, ink. Codes: MKT IND ECO TEC POL SPT WLD.
2. Meter — ten ticks, chars `▮` (filled = round(score/10), min 1) + `▯` (rest), 12px mono, letter-spacing 2px. Filled ticks in the status color; unfilled in `--pw-meter-off`. (Chars keep it DOM-cheap; an SVG tick row is an acceptable equivalent.)
3. Score — right-aligned 34px col, 16/600 mono tabular, ink.
4. Status word — 86px col right-aligned, 9 mono 600, 0.12em, in status color: QUIET / WARMING / HOT.
States: **Calibrating** — meter ticks and status word in `--pw-ink-dim`, score in dim, word CALIBRATING. **Unknown** — score `—`, all ticks unfilled, status word chip inverted: `--pw-unknown-bg` bg, `--pw-unknown-fg` text, centered, word UNKNOWN. **Interaction:** whole row is the tap target (min 44px); tap filters the wire to that desk; active row: 3px inset left border in ink + code underlined; second tap clears ("ALL"). Hover/focus: background `--pw-rule` at 30% opacity; visible 2px ink focus outline.
Under-board honesty note (when any desk calibrating): 11 mono dim, 1.6 lh: `CALIBRATING — learning what normal sounds like for each hour of the week. {x} of 14 mornings collected. Scores are provisional, not baselined.`

### 4.5 The Wire (`BentoGrid.tsx` + `HighlightTile.tsx` → wire rows)
Header: `THE WIRE` left, `{n} ITEMS · CAP 8` right (9 mono dim). Rows (replaces bento tiles entirely): 1px rule-separated, padding 10px 0; slug line `07:12 IST · ECO · SOURCE +N` (10 mono 500 dim, uppercase; `+N` = extra sources) then headline (16/600 display, ink, 140–160-char flash form). Whole row tappable → brief overlay; no per-row buttons, no thumbnails, no heat chips unless velocity ≥3: append ` · ▲5 SRC/40M` to slug in the desk's status color. Terminator after last row: `— END OF WIRE · {n} ITEMS · NOTHING HELD BACK —` (9 mono dim, 0.16em, centered). Never pad below the heat floor. In UNKNOWN state, header becomes `LAST CONFIRMED WIRE / AS OF {time} IST` and headlines render in `--pw-ink-dim`.

### 4.6 TREND (`VibePanel.tsx`)
The only boxed element: 1px **dashed** `--pw-ink-dim` border (dashed = lower-trust texture), margin 16px gutter, padding 12px 14px. Header: `TREND` (13/700) left, `UNVERIFIED SOCIAL SIGNAL` (9 mono dim) right. Items: dotted 1px separators; slug `REDDIT · r/INDIAINVESTMENTS · RISING` / `X · #RBI · SURGING` (10 mono dim), then one line 14/600 display with the velocity fact ("14k posts/hr against a ~1.2k normal — social is 20 minutes ahead of the wire"). **Empty state (designed):** header + one body line, 11 mono dim: `NO SURGE. Reddit and X at normal chatter for a {weekday} morning. This panel only speaks when social runs ahead of the wire.` Never hide the panel; its silence is information.

### 4.7 Status bar (`StatusBar.tsx`)
Top 3px ink rule; min-height 48px; left `UPDATED 1 MIN AGO · AUTO 10 MIN` (10 mono dim); right refresh button `↻` (char), 1px ink border, ≥44×32px visual with ≥44px hit area. Unknown state: left becomes `LAST GOOD UPDATE {n} MIN AGO` in `--pw-ink`.

### 4.8 Onboarding line (`OnboardingLine.tsx`)
One row under the folio, 11 mono dim between 1px rules: `PULSEWIRE TELLS YOU WHETHER YOU NEED THE NEWS AT ALL. UNDER 30 SECONDS. [GOT IT]` — GOT IT is a 44px-tall inline bordered button. Shown once.

## 5. Motion & a11y
Motion: one thing only — on data refresh, the verdict stamp and any changed score do a 120ms opacity dip (0.4→1). No skeleton shimmer (loading = meter ticks filling left-to-right, 400ms, once). `prefers-reduced-motion`: none at all. Focus: 2px solid ink outline, offset 2px, everywhere. Status is never color-alone: every color carries its word (QUIET/WARMING/HOT/UNKNOWN) — colorblind-safe by construction. Lang: `en-IN`; times always IST-suffixed.

## 6. Responsive
360–430px: as mocked (400px frames). ≥768px: gutter 24px, verdict 32px, headline 17px. ≥1024px: 680px column centered on `--pw-paper`; folio absorbs the lens toggle inline right. Never a grid of cards; never horizontal scroll.

## 7. Theme meta
`<meta name="theme-color">`: `#F4F5F2` light / `#0E120F` dark. Early theme script keeps `data-theme` (or `.dark`) on `<html>`; both selectors are in tokens.css.
