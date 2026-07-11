"use client";

import { Sticker } from "@/components/Sticker";
import { evidenceLine, signalStateLabel } from "@/lib/fusion";
import { relativeAge } from "@/lib/time";
import type { HighlightItem } from "@/lib/types";

export type TileTone = "mega" | "teal" | "lav" | "card";

type HighlightTileProps = {
  item: HighlightItem;
  tone: TileTone;
  showSection: boolean;
  mega?: boolean;
  index?: number;
  /** v3.1 Brief — tap opens overlay instead of navigating away. */
  onOpenBrief?: (item: HighlightItem) => void;
};

function tileTestId(item: HighlightItem, index: number): string {
  const section = item.section ?? "x";
  const slug = item.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `tile-${section}-${index}-${slug || "item"}`;
}

/**
 * Signal design: stories are quiet list rows, not cards. The only color is
 * a left stripe the story earned — marigold for the confirmed multi-source
 * lead (mega), nothing otherwise. Badges are inline, not floating stickers.
 */
export function HighlightTile({
  item,
  tone: _tone,
  showSection,
  mega = false,
  index = 0,
  onOpenBrief,
}: HighlightTileProps) {
  const href = item.sources[0]?.url;
  const clickable = Boolean(href) || Boolean(onOpenBrief);
  const showHotSticker = mega && item.hot && item.sources.length >= 2;
  const showNewSticker = Boolean(item.isNew);
  const testId = tileTestId(item, index);
  const state = item.signalState ?? "confirmed";
  const isEarly = state === "early";
  const isBuilding = state === "building";
  const hasBadges = showHotSticker || showNewSticker || isEarly || isBuilding;

  const body = (
    <span className="flex w-full items-stretch gap-3">
      <span
        aria-hidden
        className={`w-[3px] shrink-0 self-stretch rounded-[2px] ${
          mega ? "bg-[var(--warm)]" : "bg-transparent"
        }`}
      />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            data-testid="tile-text"
            className={`min-w-0 font-semibold text-[var(--ink)] ${
              mega
                ? "text-[16.5px] leading-[1.35]"
                : "text-[14.5px] leading-[1.42]"
            }`}
          >
            {item.text}
          </span>
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasBadges ? (
            <>
              {isEarly ? (
                <span data-testid="signal-early">
                  <Sticker>⚡ early · unconfirmed</Sticker>
                </span>
              ) : null}
              {isBuilding ? (
                <span data-testid="signal-building">
                  <Sticker>◐ gaining traction</Sticker>
                </span>
              ) : null}
              {showHotSticker ? (
                <span data-testid="hot-sticker">
                  <Sticker className="!border-[var(--warm)] !text-[var(--ink)]">
                    {`${item.sources.length} sources`}
                  </Sticker>
                </span>
              ) : null}
              {showNewSticker ? (
                <span data-testid="new-sticker">
                  <Sticker className="!border-[var(--brand)] !text-[var(--brand)]">
                    new
                  </Sticker>
                </span>
              ) : null}
            </>
          ) : null}
          <span
            data-testid="tile-evidence"
            className="pw-mono text-[10px] uppercase tracking-[0.07em] text-[var(--faint)]"
          >
            {evidenceLine(item)}
            {" · "}
            {relativeAge(item.publishedAt)}
            {showSection && item.section ? ` · ${item.section}` : ""}
            {isEarly || isBuilding ? (
              <span data-testid="signal-label">
                {" · "}
                {signalStateLabel(state)}
              </span>
            ) : null}
            {item.velocity != null && item.velocity >= 3 ? (
              <span data-testid="heat-chip">
                {" · "}▲ {Math.round(item.velocity * 10) / 10}
              </span>
            ) : null}
          </span>
          {onOpenBrief ? (
            <span
              data-testid="brief-hint"
              className="pw-mono pointer-events-none text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-80"
              aria-hidden
            >
              → brief
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );

  const className = `pw-fade-in group relative block w-full min-h-11 py-3 pr-1 text-left ${
    clickable ? "cursor-pointer" : ""
  } ${isEarly ? "opacity-90" : ""}`;

  const dataAttrs = {
    "data-testid": testId,
    "data-tile": "highlight",
    "data-section": item.section ?? "",
    "data-hot": item.hot ? "1" : "0",
    "data-mega": mega ? "1" : "0",
    "data-signal": state,
  };

  if (!clickable) {
    return (
      <div className={className} aria-disabled {...dataAttrs}>
        {body}
      </div>
    );
  }

  // Brief opener — source link lives in the overlay footer (SPEC v3.1).
  if (onOpenBrief) {
    return (
      <button
        type="button"
        className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}
        onClick={() => onOpenBrief(item)}
        {...dataAttrs}
        data-cluster-id={item.clusterId || ""}
      >
        {body}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}
      {...dataAttrs}
    >
      {body}
    </a>
  );
}

/** Deterministic lead assignment — mega only when truly hot (not decorative). */
export function assignTileTones(
  items: HighlightItem[]
): { item: HighlightItem; tone: TileTone; mega: boolean }[] {
  const sorted = [...items].sort((a, b) => {
    const heatDiff = (b.heat ?? 0) - (a.heat ?? 0);
    if (heatDiff !== 0) return heatDiff;
    const aMerged = a.hot ? a.sources.length : 0;
    const bMerged = b.hot ? b.sources.length : 0;
    if (aMerged !== bMerged) return bMerged - aMerged;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  // Defense behind stripPublisherSuffix — stubs never own the mega slot.
  const megaIdx = sorted.findIndex(
    (item) =>
      Boolean(item.hot) &&
      (item.sources?.length ?? 0) >= 3 &&
      (item.heat ?? 0) >= 8 &&
      (item.text?.trim().length ?? 0) >= 15,
  );

  return sorted.map((item, index) => {
    if (index === megaIdx) {
      return { item, tone: "mega" as const, mega: true };
    }
    // Rows are tone-free in Signal; tone kept for API compat.
    return { item, tone: "card" as const, mega: false };
  });
}
