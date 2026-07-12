"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LensToggle } from "@/components/LensToggle";
import type { Lens, TimeWindow } from "@/lib/types";

type HeaderProps = {
  lens: Lens;
  window: TimeWindow;
  onLensChange: (lens: Lens) => void;
  onWindowChange: (window: TimeWindow) => void;
  hasLastVisit: boolean;
  night: boolean;
  onToggleNight: () => void;
  /** Appended to the time slug when true — no sticker. */
  rawMode: boolean;
};

/** "07:41 IST" — live. */
function istClock(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(now)} IST`;
}

/**
 * MORNING FEED top bar (spec §4.1 mobile pattern, used at all sizes):
 * wordmark + live IST time + lens controls + theme toggle.
 */
export function Header({
  lens,
  window,
  onLensChange,
  onWindowChange,
  hasLastVisit,
  night,
  onToggleNight,
  rawMode,
}: HeaderProps) {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const tick = () => setClock(istClock(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-[var(--pw-line)] pb-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1
            className="pw-display m-0 text-[20px] font-extrabold leading-none tracking-[0.04em] text-[var(--pw-ink)]"
            data-testid="brand"
          >
            PulseWire
          </h1>
          <span
            className="pw-mono text-[12px] text-[var(--pw-dim)]"
            suppressHydrationWarning
          >
            {clock}
            {rawMode ? " · raw" : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LensToggle
            lens={lens}
            window={window}
            onLensChange={onLensChange}
            onWindowChange={onWindowChange}
            hasLastVisit={hasLastVisit}
          />
          <ThemeToggle night={night} onToggle={onToggleNight} />
        </div>
      </div>
    </header>
  );
}
