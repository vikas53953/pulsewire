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

/**
 * WIRE DESK "The Wire" (spec §4.5): ruled wire rows with an explicit
 * END OF WIRE terminator — a closed edition, not a starved feed.
 */
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
      <div data-testid="bento-skeleton" className="flex flex-col gap-2 pt-3">
        <div className="pw-skeleton h-[46px]" />
        <div className="pw-skeleton h-[46px]" />
        <div className="pw-skeleton h-[46px]" />
      </div>
    );
  }

  const header = (label: string, right: string) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 pb-2 pt-4">
      <span className="pw-display text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--pw-ink)]">
        {label}
      </span>
      <span className="pw-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--pw-ink-dim)]">
        {right}
      </span>
    </div>
  );

  if (items.length === 0) {
    if (blind) {
      return (
        <div data-testid="blind-empty" className="py-2">
          {header("Last confirmed wire", "sources unreachable")}
          <p className="pw-mono m-0 border-t border-[var(--pw-rule)] py-4 text-[12px] leading-[1.55] text-[var(--pw-ink)]">
            No board while sources are unreachable — not a quiet hour.
          </p>
        </div>
      );
    }
    return (
      <div data-testid="quiet-hour" className="py-2">
        {header("The wire", "0 items")}
        <div className="border-t border-[var(--pw-rule)] py-6">
          <p className="pw-mono m-0 text-center text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--pw-ink-dim)]">
            — Quiet hour · nothing hot in the last {window} · wire closed —
          </p>
          {window === "1h" ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                data-testid="try-4h"
                onClick={onTryWiderWindow}
                className="pw-mono min-h-11 border border-[var(--pw-ink)] px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-ink)] transition-colors duration-[120ms] hover:bg-[var(--pw-rule)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
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
    <div className="py-2">
      {header(
        "The wire",
        `${items.length} ${items.length === 1 ? "item" : "items"} · cap 8`,
      )}
      <div
        data-testid="bento-grid"
        data-section={section}
        className="flex flex-col border-t border-[var(--pw-rule)]"
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
      <p className="pw-mono m-0 border-t border-[var(--pw-rule)] py-3 text-center text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--pw-ink-dim)]">
        — End of wire · {items.length}{" "}
        {items.length === 1 ? "item" : "items"} · nothing held back —
      </p>
    </div>
  );
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      data-testid="stale-banner"
      className="pw-mono w-full border border-[var(--pw-warm)] px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--pw-ink)]"
    >
      ⚠ Showing last-known news — sources unreachable
    </div>
  );
}
