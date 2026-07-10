"use client";

import type { ContentSectionId, SectionScore } from "@/lib/types";
import { SCORE_CHIP_ORDER, sectionChip } from "@/lib/types";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ContentSectionId | "all" | "vibe" | "radar";
  onSelect: (section: ContentSectionId | "all" | "vibe" | "radar") => void;
};

const LEVEL_DOT: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/** Tiny zine sparkline for 🔴 chips — heat series, newest on the right. */
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
      className="ml-1 inline-block align-middle"
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

export function ScoreChips({ scores, active, onSelect }: ScoreChipsProps) {
  const byId = new Map(scores.map((s) => [s.section, s]));

  return (
    <div
      role="tablist"
      aria-label="Section pulse scores"
      data-testid="score-chips"
      className="pw-no-scrollbar flex gap-2 overflow-x-auto pb-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === "all"}
        data-testid="chip-all"
        onClick={() => onSelect("all")}
        className={`min-h-11 shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 font-mono text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
          active === "all"
            ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
            : "bg-[var(--card)] shadow-none"
        }`}
      >
        ALL
      </button>
      {SCORE_CHIP_ORDER.map((id) => {
        const score = byId.get(id);
        const value = score?.score ?? 0;
        const level = score?.level ?? "green";
        const selected = active === id;
        const calibrating = Boolean(score?.calibrating);
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`chip-${id}`}
            data-level={level}
            data-score={value}
            data-calibrating={calibrating ? "1" : "0"}
            title={
              calibrating
                ? `${id} pulse ${value} · calibrating (need 14 samples in this hour×weekday)`
                : `${id} pulse ${value}`
            }
            onClick={() => onSelect(id)}
            className={`min-h-11 shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 font-mono text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
              selected
                ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
                : "bg-[var(--card)] shadow-none"
            }`}
          >
            {sectionChip(id)} {value}
            {LEVEL_DOT[level]}
            {calibrating ? (
              <span
                data-testid={`calibrating-${id}`}
                className="ml-1 text-[9px] opacity-60"
              >
                ~
              </span>
            ) : null}
            {level === "red" && score?.velocitySpark?.length ? (
              <Spark values={score.velocitySpark} />
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={active === "vibe"}
        data-testid="chip-vibe"
        onClick={() => onSelect("vibe")}
        className={`min-h-11 shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 font-mono text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
          active === "vibe"
            ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
            : "bg-[var(--card)] shadow-none"
        }`}
      >
        VIBE
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "radar"}
        data-testid="chip-radar"
        onClick={() => onSelect("radar")}
        className={`min-h-11 shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 font-mono text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
          active === "radar"
            ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
            : "bg-[var(--card)] shadow-none"
        }`}
      >
        RADAR
      </button>
    </div>
  );
}
