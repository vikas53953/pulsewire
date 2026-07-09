"use client";

import {
  assignTileTones,
  HighlightTile,
} from "@/components/HighlightTile";
import type { HighlightItem, SectionId, TimeWindow } from "@/lib/types";

type BentoGridProps = {
  items: HighlightItem[];
  loading: boolean;
  section: SectionId;
  window: TimeWindow;
  onTryWiderWindow: () => void;
};

export function BentoGrid({
  items,
  loading,
  section,
  window,
  onTryWiderWindow,
}: BentoGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3">
        <div className="pw-tile pw-skeleton col-span-full min-h-[140px]" />
        <div className="pw-tile pw-skeleton min-h-[120px]" />
        <div className="pw-tile pw-skeleton min-h-[120px]" />
        <div className="pw-tile pw-skeleton min-h-[120px]" />
        <div className="pw-tile pw-skeleton min-h-[120px]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex justify-center py-6">
        <div className="pw-tile relative w-full max-w-md bg-[var(--card)] p-6 text-center">
          <p className="m-0 text-[16px] font-black uppercase leading-snug text-[var(--ink)]">
            Quiet hour 😴 — nothing hot in the last {window}.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onTryWiderWindow}
              className="min-h-11 rounded-full border-2 border-[var(--ink)] bg-[var(--sticker)] px-4 text-[12px] font-black uppercase tracking-wide shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-[120ms] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--shadow)]"
            >
              Try 4h
            </button>
          </div>
        </div>
      </div>
    );
  }

  const assigned = assignTileTones(items);
  const showSection = section === "all";

  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3">
      {assigned.map(({ item, tone, mega }, index) => (
        <div
          key={`${item.publishedAt}-${item.text.slice(0, 24)}-${index}`}
          className={mega ? "col-span-full" : undefined}
        >
          <HighlightTile
            item={item}
            tone={tone}
            mega={mega}
            showSection={showSection}
          />
        </div>
      ))}
    </div>
  );
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="w-full border-2 border-[var(--ink)] bg-[var(--sticker)] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink)] shadow-[3px_3px_0_var(--shadow)]">
      ⚠ Showing last-known news — sources unreachable
    </div>
  );
}
