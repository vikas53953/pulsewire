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
  /** Appended to the folio slug when true (spec §4.1) — no sticker. */
  rawMode: boolean;
};

/** Live IST dateline: "FRI 11 JUL 2026 · 07:42 IST" */
function istFolio(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${(parts.weekday ?? "").toUpperCase()} ${parts.day} ${(parts.month ?? "").toUpperCase()} ${parts.year} · ${parts.hour}:${parts.minute} IST`;
}

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
  const [folio, setFolio] = useState<string>("");
  useEffect(() => {
    const tick = () => setFolio(istFolio(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="pw-rule-mast">
      {/* Masthead row */}
      <div className="flex items-center justify-between gap-3 py-3">
        <h1
          className="pw-display m-0 text-[24px] font-bold leading-none tracking-[0.10em] text-[var(--pw-ink)]"
          data-testid="brand"
        >
          PULSEWIRE
        </h1>
        <ThemeToggle night={night} onToggle={onToggleNight} />
      </div>

      {/* Folio: thin rule above, thick rule below */}
      <div className="border-t border-[var(--pw-rule)] pw-rule-close">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
          <span className="pw-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--pw-ink-dim)]">
            New Delhi edition
          </span>
          <span
            className="pw-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--pw-ink)]"
            suppressHydrationWarning
          >
            {folio}
            {rawMode ? (
              <span className="text-[var(--pw-ink-dim)]"> · RAW</span>
            ) : null}
          </span>
        </div>
      </div>

      {/* Lens + windows */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <LensToggle
          lens={lens}
          window={window}
          onLensChange={onLensChange}
          onWindowChange={onWindowChange}
          hasLastVisit={hasLastVisit}
        />
      </div>
    </header>
  );
}
