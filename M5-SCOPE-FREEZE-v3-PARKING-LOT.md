# PULSEWIRE — M5 SCOPE FREEZE + v3 PARKING LOT

**Owner:** Vikas · **Builder:** Grok 4.5 (Cursor) · **Date:** 2026-07-10
**Purpose of this file:** three new product ideas are now on the roadmap. They are **parked**. This file exists so you know exactly what they are, and exactly why you must NOT build any part of them during M5.

---

## 1. M5 SCOPE — UNCHANGED, FROZEN

M5 remains exactly as SPEC v2 §8 defines it:

- SQLite history writer (`pulsewire.db`, better-sqlite3) — **shipped in the first commit of M5**, writing every cycle: `(section, timestamp, sectionRaw, clusterCount, topBreadth)`. The 60-day baseline clock starts at first write.
- Baseline math: median + MAD per hour-of-day × weekday bucket; deviation blend `0.6*v0 + 0.4*sigmoid(deviation)`; `calibrating` tag until a bucket has ≥14 samples.
- Velocity sparkline on 🔴 chips (tiny, zine-styled).
- `since` lens fully server-side.
- **Boot-velocity fix if not already merged:** clusters first seen during the boot window score breadth only, velocity suppressed — no false 🔴 after restart/deploy.
- Playwright: seeded-DB deviation asserted; cold-start shows calibrating; writer survives restart; boot-window restart produces NO red verdict on quiet fixtures.

**M5 gate report must include:** green suite summary, `pulsewire.db` row count after a multi-hour run, one screenshot of a calibrating chip, root-cause notes for anything that fought back, and the 3-step verify-yourself block.

## 2. v3 PARKING LOT — VISIBLE, LOCKED, DO NOT BUILD

Three features are approved in concept for v3, in this build order. **Do not implement, scaffold, stub, or "prepare" any of them in M5.** A dedicated v3 spec will follow the M5 gate.

### v3.1 — BRIEF (first)
Tap a tile → zine overlay, four lines: **What happened / Why it matters / Who's affected / What's next.** LLM-generated on first tap, cached per cluster (one call per story ever). Source link at overlay bottom. RAW mode: overlay shows title + sources only, no fake brief. Still no full articles in-app.

### v3.2 — VIBE (second)
Cross-platform trending tab: **Reddit** (free API: r/all rising + curated India/markets/tech subreddits) side-by-side with the existing **X Pulse** (Grok x_search). Answers "what's loud on X vs Reddit right now." Instagram is permanently out of scope — no trending API exists; no scraping.

### v3.3 — RADAR (last)
Tripwire watchlists per domain (AI-lab blogs/HuggingFace, RBI press releases, NSE/BSE circulars, IMD alerts), polled every 60s separately from the 10-min RSS cycle. A defined event on a defined source fires an instant 🔴 verdict + PWA web-push. Depends on M6 PWA. Tripwire configs get their own mini-spec.

**Design principle for all three (lock):** Radar, Vibe, and Brief exist to feed the verdict. Any implementation choice that turns PulseWire into a feed to scroll is wrong by definition.

## 3. STANDING RULES (unchanged, restated because they were violated once)

1. Gate = **stop and report**. Green suite ≠ permission to continue into future scope. Even when confident. Especially when confident.
2. Every feature ships WITH its Playwright specs; the suite is cumulative; never delete old tests.
3. Where a spec is silent: quietest option + one line in `implementation-notes.md`.
4. Anything with cost attached (LLM calls, x_search, push services) requires an explicit cost note in the milestone report: calls per day at expected usage × unit price = monthly estimate.

## 4. WHAT TO SAY WHEN M5 IS DONE

Report the gate per §1 and then **stop**. Vikas reviews, runs the 5-minute human check, and hands you the v3 spec (SPEC-v3-radar-vibe-brief.md) separately. Your only valid next actions after the M5 report: fix gate findings, or wait.
