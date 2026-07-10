"use client";

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
  /** Kept for API compat; sticker no longer shown (reads as unfinished). */
  rawMode: boolean;
};

export function Header({
  lens,
  window,
  onLensChange,
  onWindowChange,
  hasLastVisit,
  night,
  onToggleNight,
  rawMode: _rawMode,
}: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1
          className="m-0 text-[22px] font-black uppercase tracking-[-0.05em] text-[var(--ink)] sm:text-[28px]"
          data-testid="brand"
        >
          PulseWire
        </h1>
        {/* RAW sticker hidden — default mode is raw; showing it reads as unfinished. */}
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
    </header>
  );
}
