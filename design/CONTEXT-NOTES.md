# PulseWire design context (captured from brief + repo — keep)

## Product
Status page for news, India-focused professionals, morning chai ritual. Success = leave in <30s with a verdict; quiet is a WIN state. No feed, no articles in-app, max ~8 stories ("fewer-but-stronger", floor 2 cap 9). Positioning: "Inshorts shortens news. PulseWire tells you whether you need news at all." Wedge: Indian traders / finance Gen-Z; Markets flagship desk.

## Structure (hierarchy locked)
1. Verdict sentence (hero, rule-based templates, ≤140 chars) — e.g. "Mostly quiet. Markets warming: Sensex jumps as FIIs return — 2 sources."
2. Seven desk chips w/ pulse score 0–100 vs normal hour: Markets MKT, India IND, Economy ECO, Tech TEC, Politics POL, Sports SPT, World WLD. Thresholds: quiet 0–39, warming 40–69, hot 70–100. Chips are navigation (tap = filter). Calibrating until ≥14 samples per hour×weekday bucket.
3. Wire board: capped story rows, source attribution + timestamps, multi-source pins ("+N"), full flash headlines 140–160 chars.
4. TREND panel (separate): Reddit rising + X pulse, unverified social signal; designed empty state.
5. Honesty states: calibrating; sources-unreachable = "STATUS UNKNOWN, NOT QUIET" (must look MORE alarming than hot, never calm); quiet-is-a-win hero; empty TREND.
Footer: updated-ago, auto-refresh 10 min, manual ↻. Lenses: "Since you left" / Windows 1h/4h/12h/24h.

## Hard requirements
- Light + dark first-class. Mobile 360px, no horiz scroll, 44px touch targets.
- Color = status meaning ONLY (calm/warming/hot/unknown), never decoration.
- 10-second scan; fewer items must feel intentional.

## Anti-goals (reject)
cream/beige+serif editorial; dark dashboard + neon accent; hairline minimalism; bento grids; pastel rounded cards; emoji in UI; centered heroes; Inter/Space Grotesk; anything Dribbble-dashboard-ish.

## Handoff contract (user's protocol)
- Branch `design/claude-design-v1` (NEVER main). Files: `design/DESIGN-SPEC.md` (tokens both themes exact hex, faces+fallbacks+reasoning, type scale, spacing, per-component specs incl. all status states, rationale), `design/tokens.css` (:root + dark block), `design/mockups/` self-contained HTML (home both themes + blind/quiet states). "Fable" agent implements from the branch.
- NOTE: my GitHub tools are read-only (list/tree/read/copy) — cannot push. Deliver design/ folder as zip + exact git commands.
- Repo components to cover: PulseWireApp, Header, VerdictHero, ScoreChips, BentoGrid→(replace with wire board), HighlightTile, VibePanel (TREND), RadarStrip, StatusBar, OnboardingLine, LensToggle/TimePills, ThemeToggle. Current tokens in app/globals.css ("Bento Zine") being replaced. Next.js + Tailwind.

## Live app sample data (real)
Scores: MKT43 IND56 ECO61 TEC47 POL48 SPT59 WLD48 (all calibrating). Verdict: "Broadly warming. Economy warming: Over 2 lakh micro food processing enterprises covered under PMFME (2 sources). Sports also warming: toss for 5th IND v ENG T20I…" + watch-line "Watch: if Economy cools without a second wave in the next hour, you can ignore it."
Stories: PMFME 2 lakh units (Hindu Business Line +1, economy); forced-labour 301 probe India tells US (Economic Times +1); T20I toss delayed (NDTV +1, sports); Vietnam boat tragedy PM condoles (NDTV +1); Mojtaba Khamenei funeral (NDTV +1, world); SIA interpol red corner notice Hizbul (TOI +1, india). Meta format: "Source +N · 2h ago · desk → brief". Legend line exists: "Pulse 0–100 vs a normal hour · bar = how loud …". Theme color currently #141414.

## Chosen direction: "WIRE DESK"
Indian broadsheet masthead + wire-service teletype + departure-board scan + instrument meters.
- Type: IBM Plex Sans Condensed (600/700, masthead/verdict/headlines) + IBM Plex Mono (400/500/600, slugs/scores/meta). Terminal heritage rationale.
- Zero border-radius. Rules are bold ink (2–4px + 1px), newspaper thick-thin, NOT hairline-only.
- Light: paper #F4F5F2, ink #17191B, dim #565B5E, rule #C6CAC6. Status: calm #1F7A44, warming #9A6A00, hot #C0361C.
- Dark: ground #0E120F (phosphor green-black), text #E9EBE3, dim #8F968D, rule #2B312C. Status: calm #52C97E, warming #E0A63C, hot #FF6A45.
- UNKNOWN: achromatic inverted plate (ink↔paper) + hazard diagonal stripes — out-contrasts hot without stealing red.
- Desk board: 7 fixed rows, code (MKT) + 10-tick meter (▮▮▮▯…) colored by status + tabular mono score + status word. Calibrating = hollow/dim.
- Wire rows: mono slug "07:12 · ECO · SOURCE +1" + condensed headline; end line "— END OF WIRE · N ITEMS · CAP 8 · NOTHING HELD BACK —".
- Verdict: status stamp chip + big left-aligned condensed sentence + mono watch-line. Quiet = big calm plate "ALL QUIET", page gets SHORTER (reward = brevity).
- TREND: dashed-border panel "UNVERIFIED SOCIAL SIGNAL", designed empty state.
- Masthead: PULSEWIRE letterspaced + folio "NEW DELHI · FRI 11 JUL 2026 · 07:42 IST"; thick-thin rules.
- DC canvas frames: 1a light mostly-quiet, 1b dark hot morning, 1c quiet-is-a-win, 1d status-unknown (dark), 1e calibrating + empty TREND (light).
