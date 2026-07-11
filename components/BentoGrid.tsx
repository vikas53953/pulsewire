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
  onOpenBrief?: (item: HighlightItem) => void;
  /** Blind board — never show "quiet hour" empty state. */
  blind?: boolean;
};

/** Signal design: stories are a quiet hairline list, not a card grid. */
export function BentoGrid({
  items,
  loading,
  section,
  window,
  onTryWiderWindow,
  onOpenBrief,
  blind = false,
}: BentoGridProps) {
  if (loading) {
    return (
      <div
        data-testid="bento-skeleton"
        className="flex flex-col gap-2 border-t border-[var(--line)] pt-3"
      >
        <div className="pw-skeleton h-[52px] rounded-[8px]" />
        <div className="pw-skeleton h-[44px] rounded-[8px]" />
        <div className="pw-skeleton h-[44px] rounded-[8px]" />
        <div className="pw-skeleton h-[44px] rounded-[8px]" />
      </div>
    );
  }

  if (items.length === 0) {
    if (blind) {
      return (
        <div data-testid="blind-empty" className="flex justify-center py-8">
          <div className="w-full max-w-md border-l-[3px] border-[var(--hot)] py-1 pl-4">
            <p className="m-0 text-[15px] font-semibold leading-snug text-[var(--ink)]">
              No board while sources are unreachable — not a quiet hour.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div data-testid="quiet-hour" className="flex justify-center py-10">
        <div className="w-full max-w-md text-center">
          <p className="pw-verdict-type m-0 text-[19px] font-bold leading-snug text-[var(--ink)]">
            Quiet hour — nothing hot in the last {window}.
          </p>
          {window === "1h" ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                data-testid="try-4h"
                onClick={onTryWiderWindow}
                className="pw-mono min-h-11 rounded-[10px] border border-[var(--line)] bg-[var(--card)] px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition-[border-color] duration-[120ms] hover:border-[var(--faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                Try 4h
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const assigned = assignTileTones(items);
  const showSection = section === "all";

  return (
    <div
      data-testid="bento-grid"
      data-section={section}
      className="flex flex-col divide-y divide-[var(--line-soft)] border-t border-[var(--line)]"
    >
      {assigned.map(({ item, tone, mega }, index) => (
        <HighlightTile
          key={`${item.publishedAt}-${item.text.slice(0, 24)}-${index}`}
          item={item}
          tone={tone}
          mega={mega}
          showSection={showSection}
          index={index}
          onOpenBrief={onOpenBrief}
        />
      ))}
    </div>
  );
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      data-testid="stale-banner"
      className="pw-mono w-full rounded-[8px] border border-[var(--warm)] bg-transparent px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink)]"
    >
      ⚠ Showing last-known news — sources unreachable
    </div>
  );
}
