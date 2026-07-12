"use client";

import type { TimeWindow } from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

type TimePillsProps = {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
};

export function TimePills({ value, onChange }: TimePillsProps) {
  return (
    <div
      role="group"
      aria-label="Time window"
      className="inline-flex overflow-hidden rounded-[var(--pw-r-chip)] border border-[var(--pw-line)] bg-[var(--pw-panel)]"
    >
      {TIME_WINDOWS.map((w) => {
        const active = w === value;
        return (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            aria-pressed={active}
            data-testid={`pill-${w}`}
            className={`min-h-11 min-w-[44px] px-3 pw-display text-[12px] font-semibold transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
              active
                ? "bg-[var(--pw-ink)] text-[var(--pw-bg)]"
                : "bg-transparent text-[var(--ink)]"
            }`}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}
