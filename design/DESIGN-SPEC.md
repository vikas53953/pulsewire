# PulseWire — MORNING FEED (Timeline) · Design Spec

Direction locked from exploration frame **7a**: a social-feed mental model repurposed for a 30-second status read. Dark theme is primary; light is co-equal. Replaces the "Bento Zine" system. `design/tokens.css` is the drop-in token file; mockups in `design/mockups/` are the visual source of truth.

## 0. Concept & rationale

PulseWire borrows the *vocabulary* users already scan fluently every morning — story rings, a pinned post, feed cards, "You're all caught up" — but every engagement mechanic is inverted into a status mechanic:

- **Story rings → desk pulse rings.** Seven fixed circles, one per desk, score inside, ring color = status. One horizontal saccade answers "is anything loud?" Quiet rings are deliberately muted (near-surface color) so a calm morning *looks* calm.
- **Pinned post → the verdict.** The product speaks first, as a post from "PulseWire". On dark theme the plate inverts (light on dark) so it is always the brightest element — the heartbeat.
- **Posts → sourced wire items.** Each story is a post *from the source* (avatar = source initials). The engagement row is replaced by evidence: `◉ pulse 61 · Economy · 2 sources agree`. No likes, no shares, no comments.
- **"You're all caught up" → the ending.** Instagram trained users that this line means *leave*. Here it is the product's promise line, always reachable within ~8 posts.
- **Trending sidebar → TREND.** Dashed borders everywhere social signal appears (dashed = unverified texture).
- **Quiet is a win**: fewer posts + green plate + sign-off copy ("Enjoy the chai — see you tomorrow"). **Status unknown out-shouts hot**: inverted achromatic plate, 4px dashed border, `?` rings, stale posts dimmed to 55%, and the caught-up line becomes a warning — you can never mistake a broken morning for a calm one.

## 1. Color

All values in `tokens.css`. Summary (light / dark):
bg `#F7F8F6`/`#131610` · panel `#FFFFFF`/`#1A1D16` · line `#E3E6DE`/`#262A21` · ink `#191B1D`/`#E8EAE0` · dim `#7A7E75`/`#8D927F` · quiet `#C2C7BC`/`#4A5142` · warm `#B98A2E`/`#D9A83E` · hot `#C0361C`/`#F0764A` · success `#3E7A55`/`#7FBF8E` · verdict plate inverted per theme · unknown plate = inverted achromatic + alert `#FF6A45`/`#B3261E`.
Rules: no hue outside status tokens; no gradients; hot plate text is always the page bg color (max contrast); every color pairs with a word (QUIET/WARMING/HOT/UNKNOWN) — never color-alone.

## 2. Type

- **UI/display:** Archivo (400/500/600/700/800). Wordmark 800 tracking .04em.
- **Evidence layer:** Spline Sans Mono (400/500/600) for every timestamp, pulse number, tag, meta line. Tabular numerals.
Scale (px/weight/lh): verdict text 26/600/1.32 · post headline 20/500/1.4 · ring score 18/700 · section titles 16/700 · nav 17 · meta/mono 13/500 · tags 12/600 ls .08em · caught-up 16/600. Mobile: verdict 17, headline 15, ring score 13. `text-wrap: pretty` on verdict + headlines.

## 3. Layout & spacing

Desktop ≥1200px: 3 columns `250px / fluid (max 760px) / 380px` (nav / feed / trend). 992–1199: trend collapses under feed. <768: single column; nav becomes top bar; rings row spans full width (7 × 44px rings fit 360px with 4px gaps, no horizontal scroll). 4px grid; card padding 20–26px desktop, 14–16px mobile; feed gutter 36px desktop, 16px mobile. All interactive elements ≥44px hit area (rings, posts, nav items, refresh).

## 4. Components (repo mapping)

### 4.1 Nav rail (`Header.tsx` → SideNav)
Items: Today (active, `●` prefix), Desks, Trend, History. Active = ink, rest dim. Bottom-pinned mono status: `07:41 IST · auto 10 min`. Mobile: top bar with wordmark + time + theme toggle (44×44).

### 4.2 Desk rings (`ScoreChips.tsx` → DeskRings)
64px circle (44px mobile), 4px border (3px mobile), panel fill, score centered (18/700; quiet scores render in dim, warm/hot in ink), desk name below (13/500 dim). Border: solid + status color. **Calibrating:** dotted border, dim score, legend line under row: `dotted = calibrating · x of 14 mornings learned · scores provisional`. **Unknown:** dashed border in `--pw-unknown`, `?` instead of score. Tap = filter feed to desk (ring gains 2px outer offset outline in ink); tap again clears. Order fixed: Markets, India, Economy, Tech, Politics, Sports, World.

### 4.3 Verdict plate (`VerdictHero.tsx` → PinnedVerdict)
Card radius 16, padding 24×30 (16×18 mobile). Header: `PulseWire` (15/700) + mono tag `VERDICT · PINNED · 07:41` in `--pw-verdict-tag`. Body 26/600. Optional watch-line 15 mono in `--pw-verdict-dim`, prefix `watch — `.
States:
- **Normal:** bg `--pw-verdict-bg` (inverted per theme).
- **Hot:** bg `--pw-hot`, ink = page bg, tag `VERDICT · {DESK} HOT · {time}`.
- **All quiet:** bg `--pw-win-bg`, 2px solid `--pw-success` border, tag `VERDICT · ALL QUIET`, copy pattern: "All seven desks are quiet. Nothing needs you today — closing this tab is the product working. ☕"; watch-line becomes `top of the quiet — {headline} ({time})`.
- **Unknown:** bg `--pw-unk-bg` (inverted), 4px dashed ink border, tag `⚠ STATUS UNKNOWN — NOT QUIET · VERDICT WITHHELD` in `--pw-unk-alert`, body: `{n} of 7 desks unreachable since {time}. Absence of signal is not calm. Retrying every 60 seconds.`

### 4.4 Post card (`BentoGrid.tsx`/`HighlightTile.tsx` → PostCard)
Panel bg, 1px line border, radius 16. Header: 36px avatar (source initials, `--pw-av` bg) + source name (15/600) + mono meta `+N sources · 29m`. Headline 20/500. Evidence row (13 mono): `◉ pulse {score}` in the desk's status color · desk name · `{n} sources agree`. Whole card tappable → source. Cap 8; never pad. **Stale (unknown state):** opacity .55, meta `as of {time}`, evidence `confirmed {time}`.

### 4.5 Caught-up line (StatusBar concept)
Centered, 16/600. Normal: `✓ You're all caught up — {n} posts was the whole morning` in `--pw-success`. Hot: `✓ Caught up — all heat is {desk}. Nothing else moved.` in dim. Quiet-win: `✓ That's everything. One routine post. Enjoy the chai — see you tomorrow.` in success. Unknown: `⚠ Cannot confirm you're caught up — feeds down. Do not read silence as quiet.` in `--pw-hot`/alert. This line always exists; it is the product promise.

### 4.6 TREND sidebar (`VibePanel.tsx`)
Title `Trending off-platform` + mono `UNVERIFIED · REDDIT + X`. Items: dashed 1.5px `--pw-dash` border, radius 12; mono slug (`r/IndiaInvestments · rising`), one 16/600 fact line with velocity vs normal. **Empty:** single item: "No surge. Reddit and X at normal {weekday} chatter. This panel speaks only when social runs ahead of the news." **Unknown:** "Social monitors down with the feeds. No signal ≠ no news." Never hide the panel.

## 5. Motion & a11y
Refresh: changed ring scores and the verdict do one 150ms opacity dip; new posts fade+4px rise in, 200ms, staggered 40ms. No shimmer, no infinite spinners (retry countdown is mono text). `prefers-reduced-motion`: none. Focus: 2px ink outline offset 2. `lang="en-IN"`, times IST. `<meta name="theme-color">` `#F7F8F6` / `#131610`.

## 6. Files
- `design/tokens.css` — drop-in custom properties, `:root` + `[data-theme='dark']`.
- `design/mockups/pulsewire-home-dark.html` — 7a canonical (dark, normal morning).
- `design/mockups/pulsewire-home-light.html` — same state, light.
- `design/mockups/pulsewire-states.html` — hot (dark), quiet-win (dark), status-unknown (dark), mobile-360 calibrating (light).
