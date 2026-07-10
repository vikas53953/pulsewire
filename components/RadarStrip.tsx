"use client";

import type { RadarStatus } from "@/lib/radar";

type RadarStripProps = {
  status: RadarStatus | null;
  active: boolean;
  onSelect: () => void;
};

export function RadarStrip({ status, active, onSelect }: RadarStripProps) {
  const clear = status?.clear !== false && !(status?.trips?.length);
  const label = clear
    ? "RADAR CLEAR"
    : `RADAR TRIPPED · ${status?.trips?.[0]?.name ?? "tripwire"}`;

  return (
    <button
      type="button"
      data-testid="radar-strip"
      data-clear={clear ? "1" : "0"}
      aria-pressed={active}
      onClick={onSelect}
      className={`min-h-11 w-full border-2 border-[var(--ink)] px-3 py-2 text-left font-mono text-[12px] font-black uppercase tracking-wide ${
        clear
          ? "bg-[var(--card)]"
          : "bg-[var(--mega)] text-[var(--mega-fg)]"
      } ${active ? "shadow-[3px_3px_0_var(--shadow)]" : ""}`}
    >
      {clear ? "🟢 " : "🔴 "}
      {label}
    </button>
  );
}
