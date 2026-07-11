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

/** Chip row includes TREND after World (owner: dedicated panel, not under every desk). */
export type ChipId = ContentSectionId | "all" | "trend";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ChipId;
  onSelect: (section: ChipId) => void;
  /** Desk named in the verdict — subtle emphasis so users re-find it fast. */
  drivingSection?: ContentSectionId | null;
};

/** Gauge fill color per level (Signal: color only where status earned it). */
const LEVEL_FILL: Record<string, string> = {
  green: "bg-[var(--calm)]",
  yellow: "bg-[var(--warm)]",
  red: "bg-[var(--hot)]",
};

const LEVEL_NUM: Record<string, string> = {
  green: "text-[var(--ink)]",
  yellow: "text-[var(--ink)]",
  red: "text-[var(--hot)]",
};

function Spark({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 0.1);
  const w = 28;
  const h = 10;
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 1) - 0.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      data-testid="velocity-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle text-[var(--hot)]"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Instrument-card chip: label, number, gauge bar (how warm, not just that). */
const gaugeChip = (selected: boolean, driving: boolean) =>
  `min-h-11 min-w-[72px] shrink-0 rounded-[10px] border bg-[var(--card)] px-2.5 pb-2 pt-1.5 text-left transition-[border-color,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
    selected
      ? "border-[var(--ink)]"
      : driving
        ? "border-[var(--warm)]"
        : "border-[var(--line)] hover:border-[var(--faint)]"
  }`;

/** Plain text chip (ALL / TREND) — same height, quieter body. */
const textChip = (selected: boolean) =>
  `min-h-11 shrink-0 self-stretch rounded-[10px] border px-4 pw-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-[border-color,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
    selected
      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
      : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--faint)]"
  }`;

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
        // Sequence: calibrating explainer only after onboarding is done
        // (or on a later visit when onboard was already dismissed).
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
      <p className="pw-mono m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
        Desks
      </p>
      <div
        role="tablist"
        aria-label="Section pulse scores"
        data-testid="score-chips"
        className="flex flex-wrap items-stretch gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          data-testid="chip-all"
          onClick={() => onSelect("all")}
          onFocus={() => setPeek(null)}
          onMouseEnter={() => setPeek(null)}
          className={textChip(active === "all")}
        >
          ALL
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
          const fillPct = unknown ? 0 : Math.max(0, Math.min(100, value));
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
              onClick={() => onSelect(id)}
              onFocus={() => setPeek(id)}
              onMouseEnter={() => setPeek(id)}
              onMouseLeave={() => setPeek((cur) => (cur === id ? null : cur))}
              onBlur={() => setPeek((cur) => (cur === id ? null : cur))}
              className={gaugeChip(selected, driving)}
            >
              <span className="flex items-center gap-1">
                <span className="pw-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">
                  {sectionChip(id)}
                </span>
                {driving ? (
                  <span
                    data-testid={`driving-dot-${id}`}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warm)]"
                    aria-hidden
                  />
                ) : null}
                {socialLed ? (
                  <span
                    data-testid={`social-led-${id}`}
                    className="text-[10px]"
                  >
                    ⚡
                  </span>
                ) : null}
                {!unknown && level === "red" && score?.velocitySpark?.length ? (
                  <Spark values={score.velocitySpark} />
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
                className={`mt-0.5 block text-[17px] font-bold leading-none tabular-nums ${
                  calibrating ? "opacity-45" : ""
                } ${unknown ? "text-[var(--faint)]" : LEVEL_NUM[level]}`}
              >
                <span data-testid={`pulse-score-${id}`}>
                  {unknown ? "—" : value}
                </span>
              </span>
              {calibrating ? (
                <span data-testid={`calibrating-${id}`} className="sr-only">
                  calibrating
                </span>
              ) : null}
              <span
                className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-[2px] bg-[var(--track)]"
                aria-hidden
              >
                <span
                  className={`block h-full rounded-[2px] ${
                    unknown ? "bg-transparent" : LEVEL_FILL[level]
                  } ${calibrating ? "opacity-45" : ""}`}
                  style={{ width: `${fillPct}%` }}
                />
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={active === "trend"}
          data-testid="chip-trend"
          title="Trend — Reddit and X across all categories"
          onClick={() => onSelect("trend")}
          onFocus={() => setPeek(null)}
          onMouseEnter={() => setPeek(null)}
          className={textChip(active === "trend")}
        >
          TREND
        </button>
      </div>
      {showCalExplainer ? (
        <p
          data-testid="calibrating-explainer"
          className="m-0 flex items-start gap-2 text-[12px] leading-snug text-[var(--muted)]"
          role="status"
        >
          <span className="min-w-0 flex-1">
            Pulse gets accurate after ~2 weeks of history — muted scores are
            still learning a normal hour.
          </span>
          <button
            type="button"
            data-testid="calibrating-dismiss"
            className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--ink)] underline decoration-[var(--muted)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
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
          className="m-0 max-w-2xl text-[12px] font-semibold leading-snug text-[var(--ink)] opacity-80"
        >
          {whyLine}
        </p>
      ) : (
        <p
          data-testid="pulse-legend"
          className="pw-mono m-0 px-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--faint)]"
        >
          Pulse 0–100 vs a normal hour · bar = how loud · green quiet · amber
          warming · red hot · — unknown · muted = calibrating · ⚡ social-led ·
          hover a chip for why
        </p>
      )}
    </div>
  );
}

export type { SectionId };
