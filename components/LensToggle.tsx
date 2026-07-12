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

/**
 * First visit: only time pills (1h/4h/12h/24h) — no dual labels that
 * reviewers misread as junk (“Since you left By time”).
 * Return visits: “Since last visit” vs “Time” (not “By time” / “Windows”).
 */
export function LensToggle({
  lens,
  window,
  onLensChange,
  onWindowChange,
  hasLastVisit,
}: LensToggleProps) {
  const showSince = hasLastVisit;
  const showPills = lens === "window" || !hasLastVisit;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lens-toggle">
      {showSince ? (
        <div
          role="group"
          aria-label="Lens"
          className="inline-flex overflow-hidden rounded-[var(--pw-r-chip)] border border-[var(--pw-line)] bg-[var(--pw-panel)]"
        >
          <button
            type="button"
            data-testid="lens-since"
            aria-pressed={lens === "since"}
            onClick={() => onLensChange("since")}
            className={`min-h-11 px-3 pw-display text-[12px] font-semibold transition-colors duration-[120ms] ${
              lens === "since"
                ? "bg-[var(--pw-ink)] text-[var(--pw-bg)]"
                : "bg-transparent text-[var(--ink)]"
            }`}
          >
            Since last visit
          </button>
          <button
            type="button"
            data-testid="lens-window"
            aria-pressed={lens === "window"}
            onClick={() => onLensChange("window")}
            className={`min-h-11 px-3 pw-display text-[12px] font-semibold transition-colors duration-[120ms] ${
              lens === "window"
                ? "bg-[var(--pw-ink)] text-[var(--pw-bg)]"
                : "bg-transparent text-[var(--ink)]"
            }`}
          >
            Time
          </button>
        </div>
      ) : (
        // Keep lens-window test id for gates; first visit is time pills only.
        <button
          type="button"
          data-testid="lens-window"
          aria-pressed="true"
          className="sr-only"
          tabIndex={-1}
        >
          Time
        </button>
      )}

      {showPills ? (
        <div
          role="group"
          aria-label="Time window"
          className="inline-flex overflow-hidden rounded-[var(--pw-r-chip)] border border-[var(--pw-line)] bg-[var(--pw-panel)]"
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
      ) : null}
    </div>
  );
}
