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
      className="m-0 flex items-start gap-2 text-[12px] leading-snug text-[var(--muted)]"
      role="status"
    >
      <span className="min-w-0 flex-1">
        PulseWire tells you if India news needs you right now — green means go
        live your life.
      </span>
      <button
        type="button"
        data-testid="onboarding-dismiss"
        className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--ink)] underline decoration-[var(--muted)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
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
