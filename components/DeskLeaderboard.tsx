"use client";

import type { SectionScore } from "@/lib/types";
import { sectionLabel } from "@/lib/types";

const LEVEL_COLOR: Record<string, string> = {
  green: "var(--pw-quiet)",
  yellow: "var(--pw-warm)",
  red: "var(--pw-hot)",
};

/**
 * SIGNAL BLACK right-rail leaderboard (spec §4): desks sorted by pulse,
 * 5px bar width = score, colored by status. A vertical answer to
 * "which desk is loudest right now?"
 */
export function DeskLeaderboard({ scores }: { scores: SectionScore[] }) {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return (
    <section
      data-testid="desk-leaderboard"
      aria-label="Desk leaderboard"
      className="pw-card px-4 py-4"
    >
      <h2 className="pw-display m-0 mb-3 text-[16px] font-bold text-[var(--pw-ink)]">
        Desk leaderboard
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {sorted.map((s) => {
          const unknown = Boolean(s.unknown);
          const color = unknown
            ? "var(--pw-unknown)"
            : LEVEL_COLOR[s.level] ?? "var(--pw-quiet)";
          const width = unknown ? 0 : Math.max(2, Math.min(100, s.score));
          return (
            <li key={s.section} className="flex items-center gap-3">
              <span className="pw-display w-[72px] shrink-0 truncate text-[13px] font-medium text-[var(--pw-dim)]">
                {sectionLabel(s.section)}
              </span>
              <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--pw-line)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${width}%`, background: color }}
                />
              </span>
              <span
                className="pw-mono pw-tabular w-[28px] shrink-0 text-right text-[12px] font-semibold"
                style={{
                  color: unknown ? "var(--pw-unknown)" : "var(--pw-ink)",
                }}
              >
                {unknown ? "?" : s.score}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
