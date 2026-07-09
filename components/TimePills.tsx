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
      className="inline-flex overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--card)]"
    >
      {TIME_WINDOWS.map((w) => {
        const active = w === value;
        return (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            aria-pressed={active}
            className={`min-h-11 min-w-[44px] px-3 text-[12px] font-black uppercase tracking-wide transition-colors duration-[120ms] ${
              active
                ? "bg-[var(--ink)] text-[var(--paper)]"
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
