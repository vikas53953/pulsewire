"use client";

import { Sticker } from "@/components/Sticker";
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
  rawMode,
}: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="m-0 flex items-center text-[22px] font-black uppercase tracking-[-0.05em] text-[var(--ink)] sm:text-[28px]">
          <span>Pulse</span>
          <span
            className="ml-0.5 inline-block bg-[var(--ink)] px-1.5 py-0.5 text-[var(--paper)]"
            style={{ transform: "rotate(-2deg)" }}
          >
            Wire
          </span>
        </h1>
        {rawMode ? (
          <span data-testid="raw-sticker">
            <Sticker>RAW</Sticker>
          </span>
        ) : null}
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
