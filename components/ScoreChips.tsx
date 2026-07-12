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

/** Ring row + feed tabs; ALL and TREND live as feed tabs. */
export type ChipId = ContentSectionId | "all" | "trend";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ChipId;
  onSelect: (section: ChipId) => void;
  /** Desk named in the verdict — subtle emphasis so users re-find it fast. */
  drivingSection?: ContentSectionId | null;
};

const LEVEL_COLOR: Record<string, string> = {
  green: "var(--pw-quiet)",
  yellow: "var(--pw-warm)",
  red: "var(--pw-hot)",
};

/** Feed tab (TODAY / TREND) — Archivo, underline-active. */
const feedTab = (selected: boolean) =>
  `pw-display min-h-11 px-1 text-[16px] font-bold transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)] ${
    selected
      ? "text-[var(--pw-ink)] underline decoration-2 underline-offset-8"
      : "text-[var(--pw-dim)] hover:text-[var(--pw-ink)]"
  }`;

/**
 * MORNING FEED desk rings (spec §4.2): story-ring vocabulary inverted into
 * status — seven fixed circles, score inside, ring color = status. Quiet
 * rings are deliberately muted so a calm morning looks calm.
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
    <div className="flex flex-col gap-2">
      {/* Feed tabs: TODAY (all) · TREND */}
      <div className="flex items-center gap-5 border-b border-[var(--pw-line)]">
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          data-testid="chip-all"
          onClick={() => onSelect("all")}
          className={feedTab(active === "all")}
        >
          Today
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "trend"}
          data-testid="chip-trend"
          title="Trend — Reddit and X across all categories"
          onClick={() => onSelect("trend")}
          className={feedTab(active === "trend")}
        >
          Trend
        </button>
        <span
          data-testid="pulse-legend"
          className="pw-mono ml-auto hidden text-[11px] text-[var(--pw-dim)] sm:block"
        >
          pulse 0–100 vs normal hour
        </span>
      </div>

      {/* Desk rings */}
      <div
        role="tablist"
        aria-label="Section pulse scores"
        data-testid="score-chips"
        className="flex flex-row flex-wrap items-start justify-between gap-1 py-2 sm:justify-start sm:gap-4"
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
          const ringColor = unknown
            ? "var(--pw-unknown)"
            : LEVEL_COLOR[level];
          const borderStyle = unknown
            ? "dashed"
            : calibrating
              ? "dotted"
              : "solid";
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
              className="flex min-h-11 min-w-[44px] flex-col items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
            >
              <span
                aria-hidden
                className="flex h-[44px] w-[44px] items-center justify-center bg-[var(--pw-panel)] sm:h-[64px] sm:w-[64px]"
                style={{
                  borderRadius: "9999px",
                  borderWidth: "var(--pw-ring-b)",
                  borderStyle,
                  borderColor: ringColor,
                  outline: selected ? "2px solid var(--pw-ink)" : undefined,
                  outlineOffset: selected ? "2px" : undefined,
                }}
              >
                <span
                  data-testid={`pulse-num-${id}`}
                  aria-label={
                    unknown
                      ? "Pulse unknown"
                      : calibrating
                        ? `Pulse ${value}, still calibrating`
                        : `Pulse ${value}`
                  }
                  className={`pw-mono pw-tabular text-[13px] font-bold sm:text-[18px] ${
                    unknown || calibrating || level === "green"
                      ? "text-[var(--pw-dim)]"
                      : "text-[var(--pw-ink)]"
                  }`}
                >
                  <span data-testid={`pulse-score-${id}`}>
                    {unknown ? "?" : value}
                  </span>
                </span>
              </span>
              <span
                className={`pw-display text-[11px] sm:text-[13px] ${
                  selected
                    ? "font-semibold text-[var(--pw-ink)]"
                    : "font-medium text-[var(--pw-dim)]"
                }`}
              >
                {sectionLabel(id)}
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
                    soc
                  </span>
                ) : null}
              </span>
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
          className="pw-mono m-0 flex items-center gap-2 text-[12px] leading-[1.6] text-[var(--pw-dim)]"
          role="status"
        >
          <span className="min-w-0 flex-1">
            dotted = calibrating · learning what a normal morning sounds like ·
            scores provisional
          </span>
          <button
            type="button"
            data-testid="calibrating-dismiss"
            className="pw-display min-h-11 shrink-0 rounded-[var(--pw-r-chip)] border border-[var(--pw-line)] bg-[var(--pw-panel)] px-3 text-[12px] font-semibold text-[var(--pw-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
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
