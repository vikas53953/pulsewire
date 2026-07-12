"use client";

import { useEffect, useState } from "react";
import { pulseWhy } from "@/lib/copy";
import {
  CALIBRATING_KEY,
  ONBOARD_DISMISSED_EVENT,
  ONBOARD_KEY,
} from "@/lib/first-visit";
import type {
  ContentSectionId,
  SectionId,
  SectionScore,
  TrafficLevel,
} from "@/lib/types";
import { SCORE_CHIP_ORDER, sectionChip } from "@/lib/types";

/** Board row set includes ALL + TREND actions (owner: dedicated panel). */
export type ChipId = ContentSectionId | "all" | "trend";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ChipId;
  onSelect: (section: ChipId) => void;
  /** Desk named in the verdict — subtle emphasis so users re-find it fast. */
  drivingSection?: ContentSectionId | null;
};

const LEVEL_COLOR: Record<string, string> = {
  green: "var(--pw-calm)",
  yellow: "var(--pw-warm)",
  red: "var(--pw-hot)",
};

const LEVEL_WORD: Record<string, string> = {
  green: "QUIET",
  yellow: "WARMING",
  red: "HOT",
};

/** Departure-board tick meter: ▮ filled in status color, ▯ unfilled. */
function Meter({
  score,
  color,
  dim,
  empty = false,
}: {
  score: number;
  color: string;
  dim: boolean;
  /** Unknown state: all ticks unfilled (spec §4.4). */
  empty?: boolean;
}) {
  const filled = empty ? 0 : Math.max(1, Math.round(score / 10));
  return (
    <span
      aria-hidden
      className="pw-mono text-[12px] leading-none tracking-[2px]"
    >
      <span style={{ color: dim ? "var(--pw-ink-dim)" : color }}>
        {"▮".repeat(Math.min(10, filled))}
      </span>
      <span style={{ color: "var(--pw-meter-off)" }}>
        {"▯".repeat(Math.max(0, 10 - filled))}
      </span>
    </span>
  );
}

/** Small bordered action cell (ALL / TREND) — inverted when active. */
const actionCell = (selected: boolean) =>
  `pw-mono min-h-11 border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)] ${
    selected
      ? "border-[var(--pw-ink)] bg-[var(--pw-ink)] text-[var(--pw-paper)]"
      : "border-[var(--pw-ink)] bg-transparent text-[var(--pw-ink)]"
  }`;

/**
 * WIRE DESK desk board (spec §4.4): seven fixed rows in strict columns —
 * code · tick meter · tabular score · status word. Whole row is the tap
 * target; tap filters the wire to that desk.
 */
export function ScoreChips({
  scores,
  active,
  onSelect,
  drivingSection = null,
}: ScoreChipsProps) {
  const byId = new Map(scores.map((s) => [s.section, s]));
  const [peek, setPeek] = useState<ContentSectionId | null>(null);
  const peekScore = peek ? byId.get(peek) : undefined;
  const whyLine = peekScore ? pulseWhy(peekScore) : null;
  const anyCalibrating = scores.some((s) => s.calibrating && !s.unknown);
  const [showCalExplainer, setShowCalExplainer] = useState(false);

  useEffect(() => {
    const refresh = () => {
      if (!anyCalibrating) {
        setShowCalExplainer(false);
        return;
      }
      try {
        // Sequence: calibrating explainer only after onboarding is done.
        if (localStorage.getItem(ONBOARD_KEY) !== "1") {
          setShowCalExplainer(false);
          return;
        }
        if (localStorage.getItem(CALIBRATING_KEY) === "1") {
          setShowCalExplainer(false);
          return;
        }
        setShowCalExplainer(true);
      } catch {
        // private mode — skip
      }
    };
    refresh();
    window.addEventListener(ONBOARD_DISMISSED_EVENT, refresh);
    return () => window.removeEventListener(ONBOARD_DISMISSED_EVENT, refresh);
  }, [anyCalibrating]);

  return (
    <div className="flex flex-col">
      {/* Section header: DESK BOARD · legend · ALL/TREND actions */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-2 pt-1">
        <span className="pw-display text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--pw-ink)]">
          Desk board
        </span>
        <span className="flex items-center gap-2">
          <span
            data-testid="pulse-legend"
            className="pw-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--pw-ink-dim)]"
          >
            Pulse 0–100 vs normal hour
          </span>
          <button
            type="button"
            role="tab"
            aria-selected={active === "all"}
            data-testid="chip-all"
            onClick={() => onSelect("all")}
            className={actionCell(active === "all")}
          >
            ALL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === "trend"}
            data-testid="chip-trend"
            title="Trend — Reddit and X across all categories"
            onClick={() => onSelect("trend")}
            className={actionCell(active === "trend")}
          >
            TREND
          </button>
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Section pulse scores"
        data-testid="score-chips"
        className="pw-rule-close flex flex-col border-t border-[var(--pw-rule)]"
      >
        {SCORE_CHIP_ORDER.map((id) => {
          const score = byId.get(id);
          const unknown = Boolean(score?.unknown);
          const value = unknown ? 0 : (score?.score ?? 0);
          const level = (score?.level ?? "green") as TrafficLevel;
          const selected = active === id;
          const driving = Boolean(drivingSection === id && !selected);
          const calibrating = Boolean(score?.calibrating) && !unknown;
          const socialLed = Boolean(score?.socialLed) && !unknown;
          const why = score
            ? pulseWhy(score)
            : `${sectionChip(id)} pulse ${value}`;
          const color = LEVEL_COLOR[level];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-describedby={peek === id ? "pulse-why-line" : undefined}
              data-testid={`chip-${id}`}
              data-level={unknown ? "unknown" : level}
              data-score={unknown ? "" : String(value)}
              data-unknown={unknown ? "1" : "0"}
              data-calibrating={calibrating ? "1" : "0"}
              data-driving={driving ? "1" : "0"}
              data-social-led={socialLed ? "1" : "0"}
              title={why}
              onClick={() => onSelect(selected ? "all" : id)}
              onFocus={() => setPeek(id)}
              onMouseEnter={() => setPeek(id)}
              onMouseLeave={() => setPeek((cur) => (cur === id ? null : cur))}
              onBlur={() => setPeek((cur) => (cur === id ? null : cur))}
              className={`grid min-h-11 w-full grid-cols-[46px_1fr_44px_86px] items-center gap-2 border-b border-[var(--pw-rule)] px-0.5 text-left transition-colors duration-[120ms] last:border-b-0 hover:bg-[var(--pw-rule)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pw-ink)] ${
                selected
                  ? "border-l-[3px] border-l-[var(--pw-ink)] pl-2"
                  : ""
              }`}
            >
              <span
                className={`pw-display text-[15px] font-bold tracking-[0.05em] text-[var(--pw-ink)] ${
                  selected ? "underline underline-offset-4" : ""
                }`}
              >
                {sectionChip(id)}
                {driving ? (
                  <span
                    data-testid={`driving-dot-${id}`}
                    className="ml-1 inline-block h-[6px] w-[6px] align-middle"
                    style={{ background: color }}
                    aria-hidden
                  />
                ) : null}
                {socialLed ? (
                  <span
                    data-testid={`social-led-${id}`}
                    className="pw-mono ml-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--pw-ink-dim)]"
                  >
                    SOC
                  </span>
                ) : null}
              </span>

              <Meter
                score={value}
                color={color}
                dim={calibrating}
                empty={unknown}
              />

              <span
                data-testid={`pulse-num-${id}`}
                aria-label={
                  unknown
                    ? "Pulse unknown"
                    : calibrating
                      ? `Pulse ${value}, still calibrating`
                      : `Pulse ${value}`
                }
                className={`pw-mono pw-tabular text-right text-[16px] font-semibold leading-none ${
                  unknown || calibrating
                    ? "text-[var(--pw-ink-dim)]"
                    : "text-[var(--pw-ink)]"
                }`}
              >
                <span data-testid={`pulse-score-${id}`}>
                  {unknown ? "—" : value}
                </span>
              </span>

              {unknown ? (
                <span className="pw-mono bg-[var(--pw-unknown-bg)] px-1 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-unknown-fg)]">
                  UNKNOWN
                </span>
              ) : (
                <span
                  className="pw-mono text-right text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    color: calibrating ? "var(--pw-ink-dim)" : color,
                  }}
                >
                  {calibrating ? "CALIBRATING" : LEVEL_WORD[level]}
                </span>
              )}
              {calibrating ? (
                <span data-testid={`calibrating-${id}`} className="sr-only">
                  calibrating
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {showCalExplainer ? (
        <p
          data-testid="calibrating-explainer"
          className="pw-mono m-0 flex items-start gap-2 pt-2 text-[11px] leading-[1.6] text-[var(--pw-ink-dim)]"
          role="status"
        >
          <span className="min-w-0 flex-1">
            CALIBRATING — learning what normal sounds like for each hour of
            the week. Scores are provisional, not baselined.
          </span>
          <button
            type="button"
            data-testid="calibrating-dismiss"
            className="pw-mono min-h-11 shrink-0 border border-[var(--pw-ink)] px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
            onClick={() => {
              try {
                localStorage.setItem(CALIBRATING_KEY, "1");
              } catch {
                // ignore
              }
              setShowCalExplainer(false);
            }}
          >
            Got it
          </button>
        </p>
      ) : null}
      {whyLine ? (
        <p
          id="pulse-why-line"
          data-testid="pulse-why"
          className="pw-mono m-0 max-w-2xl pt-2 text-[11px] leading-[1.6] text-[var(--pw-ink)]"
        >
          {whyLine}
        </p>
      ) : null}
    </div>
  );
}

export type { SectionId };
