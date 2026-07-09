"use client";

import type { ContentSectionId, SectionScore } from "@/lib/types";
import { SCORE_CHIP_ORDER, sectionChip } from "@/lib/types";

type ScoreChipsProps = {
  scores: SectionScore[];
  active: ContentSectionId | "all";
  onSelect: (section: ContentSectionId | "all") => void;
};

const LEVEL_DOT: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

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
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`chip-${id}`}
            data-level={level}
            data-score={value}
            title={
              score?.calibrating
                ? `${id} calibrating`
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
          </button>
        );
      })}
    </div>
  );
}
