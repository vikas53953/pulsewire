"use client";

import { useEffect, useState } from "react";
import {
  ONBOARD_DISMISSED_EVENT,
  ONBOARD_KEY,
} from "@/lib/first-visit";

/**
 * One dismissible first-visit sentence — sets the product contract.
 * Returning users (flag set) render nothing so layout does not shift.
 * Calibrating explainer waits until this is dismissed (no stacked Got its).
 */
export function OnboardingLine() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARD_KEY) === "1") return;
      setShow(true);
    } catch {
      // private mode — skip
    }
  }, []);

  if (!show) return null;

  return (
    <p
      data-testid="onboarding-line"
      className="pw-mono m-0 flex items-center gap-2 border-b border-[var(--pw-rule)] py-2 text-[11px] uppercase leading-snug tracking-[0.04em] text-[var(--pw-ink-dim)]"
      role="status"
    >
      <span className="min-w-0 flex-1">
        PulseWire tells you whether you need the news at all. Under 30 seconds.
      </span>
      <button
        type="button"
        data-testid="onboarding-dismiss"
        className="pw-mono min-h-[36px] shrink-0 border border-[var(--pw-ink)] px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
        onClick={() => {
          try {
            localStorage.setItem(ONBOARD_KEY, "1");
          } catch {
            // ignore
          }
          setShow(false);
          try {
            window.dispatchEvent(new Event(ONBOARD_DISMISSED_EVENT));
          } catch {
            // ignore
          }
        }}
      >
        Got it
      </button>
    </p>
  );
}
