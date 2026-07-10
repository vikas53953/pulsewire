"use client";

import type { Lens, TimeWindow } from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

type LensToggleProps = {
  lens: Lens;
  window: TimeWindow;
  onLensChange: (lens: Lens) => void;
  onWindowChange: (window: TimeWindow) => void;
  hasLastVisit: boolean;
};

export function LensToggle({
  lens,
  window,
  onLensChange,
  onWindowChange,
  hasLastVisit,
}: LensToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lens-toggle">
      <div
        role="group"
        aria-label="Lens"
        className="inline-flex overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--card)]"
      >
        <button
          type="button"
          data-testid="lens-since"
          aria-pressed={lens === "since"}
          disabled={!hasLastVisit}
          onClick={() => onLensChange("since")}
          className={`min-h-11 px-3 text-[11px] font-black uppercase tracking-wide transition-colors duration-[120ms] disabled:opacity-40 ${
            lens === "since"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "bg-transparent text-[var(--ink)]"
          }`}
        >
          Since you left
        </button>
        <button
          type="button"
          data-testid="lens-window"
          aria-pressed={lens === "window"}
          onClick={() => onLensChange("window")}
          className={`min-h-11 px-3 text-[11px] font-black uppercase tracking-wide transition-colors duration-[120ms] ${
            lens === "window"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "bg-transparent text-[var(--ink)]"
          }`}
        >
          By time
        </button>
      </div>

      {lens === "window" ? (
        <div
          role="group"
          aria-label="Time window"
          className="inline-flex overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--card)]"
        >
          {TIME_WINDOWS.map((w) => {
            const active = w === window;
            return (
              <button
                key={w}
                type="button"
                onClick={() => onWindowChange(w)}
                aria-pressed={active}
                data-testid={`pill-${w}`}
                className={`min-h-11 min-w-[44px] px-3 text-[12px] font-black uppercase tracking-wide transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
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
      ) : null}
    </div>
  );
}
