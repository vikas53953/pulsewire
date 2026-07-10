"use client";

import { useState } from "react";
import { pulseWhy } from "@/lib/copy";
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
};

const LEVEL_DOT: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  unknown: "⚪",
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

const chipBtn = (selected: boolean) =>
  `min-h-11 shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 font-mono text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
    selected
      ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
      : "bg-[var(--card)] shadow-none"
  }`;

export function ScoreChips({ scores, active, onSelect }: ScoreChipsProps) {
  const byId = new Map(scores.map((s) => [s.section, s]));
  const [peek, setPeek] = useState<ContentSectionId | null>(null);
  const peekScore = peek ? byId.get(peek) : undefined;
  const whyLine = peekScore ? pulseWhy(peekScore) : null;

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-mono text-[10px] font-black uppercase tracking-[0.12em] opacity-55">
        Desks
      </p>
      <div
        role="tablist"
        aria-label="Section pulse scores"
        data-testid="score-chips"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          data-testid="chip-all"
          onClick={() => onSelect("all")}
          onFocus={() => setPeek(null)}
          onMouseEnter={() => setPeek(null)}
          className={chipBtn(active === "all")}
        >
          ALL
        </button>
        {SCORE_CHIP_ORDER.map((id) => {
          const score = byId.get(id);
          const unknown = Boolean(score?.unknown);
          const value = unknown ? 0 : (score?.score ?? 0);
          const level = (score?.level ?? "green") as TrafficLevel;
          const selected = active === id;
          const calibrating = Boolean(score?.calibrating) && !unknown;
          const socialLed = Boolean(score?.socialLed) && !unknown;
          const why = score
            ? pulseWhy(score)
            : `${sectionChip(id)} pulse ${value}`;
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
              data-social-led={socialLed ? "1" : "0"}
              title={why}
              onClick={() => onSelect(id)}
              onFocus={() => setPeek(id)}
              onMouseEnter={() => setPeek(id)}
              onMouseLeave={() => setPeek((cur) => (cur === id ? null : cur))}
              onBlur={() => setPeek((cur) => (cur === id ? null : cur))}
              className={`${chipBtn(selected)} inline-flex items-center gap-1.5`}
            >
              <span>{sectionChip(id)}</span>
              <span
                data-testid={`pulse-num-${id}`}
                aria-label={unknown ? "Pulse unknown" : `Pulse ${value}`}
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[13px] font-black tabular-nums leading-none ${
                  selected
                    ? "bg-[var(--ink)]/10"
                    : unknown
                      ? "bg-zinc-100 text-zinc-500"
                      : level === "red"
                        ? "bg-[var(--mega)]/15 text-[var(--mega)]"
                        : level === "yellow"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
                }`}
              >
                <span data-testid={`pulse-score-${id}`}>
                  {unknown ? "—" : value}
                </span>
                <span aria-hidden="true">
                  {unknown ? LEVEL_DOT.unknown : LEVEL_DOT[level]}
                </span>
              </span>
              {socialLed ? (
                <span data-testid={`social-led-${id}`} className="ml-0.5">
                  ⚡
                </span>
              ) : null}
              {calibrating ? (
                <span
                  data-testid={`calibrating-${id}`}
                  className="ml-0.5 text-[9px] opacity-60"
                >
                  ~
                </span>
              ) : null}
              {!unknown && level === "red" && score?.velocitySpark?.length ? (
                <Spark values={score.velocitySpark} />
              ) : null}
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
          className={chipBtn(active === "trend")}
        >
          TREND
        </button>
      </div>
      {whyLine ? (
        <p
          id="pulse-why-line"
          data-testid="pulse-why"
          className="m-0 max-w-2xl text-[12px] font-bold leading-snug text-[var(--ink)] opacity-70"
        >
          {whyLine}
        </p>
      ) : (
        <p
          data-testid="pulse-legend"
          className="m-0 px-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] opacity-55"
        >
          Pulse 0–100 vs a normal hour · 🟢 quiet · 🟡 warming · 🔴 hot · ⚪
          unknown · ~ calibrating · ⚡ social-led · hover a chip for why
        </p>
      )}
    </div>
  );
}

export type { SectionId };
