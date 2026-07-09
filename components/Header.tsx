"use client";

import { Sticker } from "@/components/Sticker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimePills } from "@/components/TimePills";
import type { TimeWindow } from "@/lib/types";

type HeaderProps = {
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
  night: boolean;
  onToggleNight: () => void;
  rawMode: boolean;
};

export function Header({
  window,
  onWindowChange,
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
        {rawMode ? <Sticker>RAW</Sticker> : null}
      </div>

      <div className="flex items-center gap-2">
        <TimePills value={window} onChange={onWindowChange} />
        <ThemeToggle night={night} onToggle={onToggleNight} />
      </div>
    </header>
  );
}
