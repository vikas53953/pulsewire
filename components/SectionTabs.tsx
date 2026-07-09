"use client";

import type { SectionId } from "@/lib/types";
import { SECTIONS } from "@/lib/types";

type SectionTabsProps = {
  value: SectionId;
  onChange: (section: SectionId) => void;
};

export function SectionTabs({ value, onChange }: SectionTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="News sections"
      className="pw-no-scrollbar flex gap-2 overflow-x-auto pb-1"
    >
      {SECTIONS.map((section) => {
        const active = section.id === value;
        const label =
          section.id === "all" ? `⚡ ${section.label}` : section.label;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(section.id)}
            className={`shrink-0 rounded-full border-2 border-[var(--ink)] px-3 py-2 text-[12px] font-black uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-[120ms] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--shadow)] ${
              active
                ? "bg-[var(--sticker)] shadow-[3px_3px_0_var(--shadow)]"
                : "bg-[var(--card)] shadow-none"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
