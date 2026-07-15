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
import { SCORE_CHIP_ORDER, sectionChip, sectionLabel } from "@/lib/types";

/** Tab row: Today (all) + seven desks + Trend. */
export type ChipId = ContentSectionId | "all" | "trend";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ChipId;
  onSelect: (section: ChipId) => void;
  /** Desk named in the verdict — subtle emphasis so users re-find it fast. */
  drivingSection?: ContentSectionId | null;
};

const LEVEL_COLOR: Record<string, string> = {
  green: "var(--pw-dim)",
  yellow: "var(--pw-warm)",
  red: "var(--pw-hot)",
};

/**
 * SIGNAL BLACK desk tabs (spec §4): topic tabs repurposed — each tab carries
 * its live pulse score under the label; one glance across the row answers
 * "is anything loud?" Active = 4px blue underline (blue = action, not status).
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

  const tabBase =
    "relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1 transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pw-accent)] hover:bg-[var(--pw-panel)]";
  const underline = (selected: boolean) =>
    selected ? (
      <span
        aria-hidden
        className="absolute inset-x-2 bottom-0 h-[4px] rounded-full bg-[var(--pw-accent)]"
      />
    ) : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label="Section pulse scores"
        data-testid="score-chips"
        className="grid grid-cols-9 border-b border-[var(--pw-line)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          data-testid="chip-all"
          onClick={() => onSelect("all")}
          onFocus={() => setPeek(null)}
          onMouseEnter={() => setPeek(null)}
          className={tabBase}
        >
          <span
            className={`pw-display text-[12px] sm:text-[15px] ${
              active === "all"
                ? "font-bold text-[var(--pw-ink)]"
                : "font-medium text-[var(--pw-dim)]"
            }`}
          >
            Today
          </span>
          <span className="pw-mono text-[11px] text-transparent">·</span>
          {underline(active === "all")}
        </button>

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
          const scoreColor = unknown
            ? "var(--pw-unknown)"
            : calibrating
              ? "var(--pw-dim)"
              : LEVEL_COLOR[level];
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
              className={tabBase}
            >
              <span
                className={`pw-display max-w-full truncate text-[12px] sm:text-[15px] ${
                  selected
                    ? "font-bold text-[var(--pw-ink)]"
                    : "font-medium text-[var(--pw-dim)]"
                }`}
              >
                <span className="sm:hidden">{sectionChip(id)}</span>
                <span className="hidden sm:inline">{sectionLabel(id)}</span>
                {driving ? (
                  <span
                    data-testid={`driving-dot-${id}`}
                    className="ml-1 inline-block h-[5px] w-[5px] rounded-full align-middle"
                    style={{ background: "var(--pw-warm)" }}
                    aria-hidden
                  />
                ) : null}
                {socialLed ? (
                  <span
                    data-testid={`social-led-${id}`}
                    className="pw-mono ml-1 text-[9px] uppercase text-[var(--pw-dim)]"
                  >
                    s
                  </span>
                ) : null}
              </span>
              <span
                data-testid={`pulse-num-${id}`}
                aria-label={
                  unknown
                    ? "Pulse unknown"
                    : calibrating
                      ? `Pulse ${value}, still calibrating`
                      : `Pulse ${value}`
                }
                className="pw-mono pw-tabular text-[11px] font-semibold leading-none"
                style={{ color: scoreColor }}
              >
                <span data-testid={`pulse-score-${id}`}>
                  {unknown ? "?" : value}
                </span>
                {calibrating ? "·c" : ""}
              </span>
              {calibrating ? (
                <span data-testid={`calibrating-${id}`} className="sr-only">
                  calibrating
                </span>
              ) : null}
              {underline(selected)}
            </button>
          );
        })}

        <button
          type="button"
          role="tab"
          aria-selected={active === "trend"}
          data-testid="chip-trend"
          title="Trend — off-platform signals (Reddit, plus X when configured)"
          onClick={() => onSelect("trend")}
          onFocus={() => setPeek(null)}
          onMouseEnter={() => setPeek(null)}
          className={tabBase}
        >
          <span
            className={`pw-display text-[12px] sm:text-[15px] ${
              active === "trend"
                ? "font-bold text-[var(--pw-ink)]"
                : "font-medium text-[var(--pw-dim)]"
            }`}
          >
            Trend
          </span>
          <span className="pw-mono text-[11px] text-transparent">·</span>
          {underline(active === "trend")}
        </button>
      </div>

      <span
        data-testid="pulse-legend"
        className="pw-mono text-[11px] text-[var(--pw-dim)]"
      >
        pulse 0–100 vs a normal hour · green quiet · yellow warming · red hot
        {anyCalibrating
          ? " · ·c = calibrating (provisional, not yet baselined)"
          : ""}
      </span>

      {showCalExplainer ? (
        <p
          data-testid="calibrating-explainer"
          className="pw-mono m-0 flex items-center gap-2 text-[12px] leading-[1.6] text-[var(--pw-dim)]"
          role="status"
        >
          <span className="min-w-0 flex-1">
            ·c = calibrating — learning what a normal morning sounds like.
            Scores are provisional, not baselined.
          </span>
          <button
            type="button"
            data-testid="calibrating-dismiss"
            className="pw-display min-h-11 shrink-0 rounded-full border border-[var(--pw-line)] bg-[var(--pw-panel)] px-4 text-[13px] font-semibold text-[var(--pw-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent)]"
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
          className="pw-mono m-0 max-w-2xl text-[12px] leading-[1.6] text-[var(--pw-ink)]"
        >
          {whyLine}
        </p>
      ) : null}
    </div>
  );
}

export type { SectionId };
