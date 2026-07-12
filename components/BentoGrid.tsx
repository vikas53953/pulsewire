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
 * MORNING FEED post feed (spec §4.4–4.5). The "you're all caught up" line
 * always exists — it is the product promise, never engagement bait.
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
      <div data-testid="bento-skeleton" className="flex flex-col gap-3 pt-3">
        <div className="pw-skeleton h-[110px]" />
        <div className="pw-skeleton h-[110px]" />
        <div className="pw-skeleton h-[110px]" />
      </div>
    );
  }

  if (items.length === 0) {
    if (blind) {
      return (
        <div data-testid="blind-empty" className="py-6">
          <p
            className="pw-display m-0 text-center text-[16px] font-semibold"
            style={{ color: "var(--pw-hot)" }}
          >
            ⚠ Cannot confirm you&rsquo;re caught up — sources unreachable. Do
            not read silence as quiet. Not a quiet hour.
          </p>
        </div>
      );
    }
    return (
      <div data-testid="quiet-hour" className="py-6">
        <p
          className="pw-display m-0 text-center text-[16px] font-semibold"
          style={{ color: "var(--pw-success)" }}
        >
          ✓ Quiet hour — nothing hot in the last {window}. That&rsquo;s
          everything.
        </p>
        {window === "1h" ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              data-testid="try-4h"
              onClick={onTryWiderWindow}
              className="pw-display min-h-11 rounded-[var(--pw-r-chip)] border border-[var(--pw-line)] bg-[var(--pw-panel)] px-4 text-[14px] font-semibold text-[var(--pw-ink)] transition-[border-color] duration-[120ms] hover:border-[var(--pw-dim)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]"
            >
              Try 4h
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const assigned = assignTileTones(items);
  const showSection = section === "all";
  const anyHot = items.some((i) => i.hot);

  return (
    <div className="py-1">
      <div
        data-testid="bento-grid"
        data-section={section}
        className="flex flex-col gap-3"
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
            stale={blind}
          />
        ))}
      </div>
      {/* The caught-up line — always reachable, always honest. */}
      <p
        data-testid="caught-up-line"
        className="pw-display m-0 py-6 text-center text-[16px] font-semibold"
        style={{ color: blind ? "var(--pw-hot)" : "var(--pw-success)" }}
      >
        {blind
          ? "⚠ Cannot confirm you're caught up — feeds down. Do not read silence as quiet."
          : anyHot
            ? `✓ Caught up — ${items.length} post${items.length === 1 ? "" : "s"} was the whole morning. Nothing else moved.`
            : `✓ You're all caught up — ${items.length} post${items.length === 1 ? "" : "s"} was the whole morning`}
      </p>
    </div>
  );
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      data-testid="stale-banner"
      className="pw-mono w-full rounded-[var(--pw-r-chip)] border border-dashed px-3 py-2 text-center text-[12px] font-medium uppercase tracking-[0.06em]"
      style={{ borderColor: "var(--pw-warm)", color: "var(--pw-ink)" }}
    >
      ⚠ Showing last-known news — sources unreachable
    </div>
  );
}
