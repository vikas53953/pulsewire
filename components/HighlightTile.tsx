"use client";

import { signalStateLabel } from "@/lib/fusion";
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

/** "07:12 IST" for the wire slug. */
function istClock(iso: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${fmt.format(new Date(iso))} IST`;
  } catch {
    return "";
  }
}

const DESK_CODE: Record<string, string> = {
  markets: "MKT",
  india: "IND",
  economy: "ECO",
  tech: "TEC",
  politics: "POL",
  sports: "SPT",
  world: "WLD",
};

/**
 * WIRE DESK wire row (spec §4.5): mono time-slug line over a condensed
 * headline. Whole row tappable; no thumbnails, no buttons, no cards.
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
  const srcName = (item.sources[0]?.name || "wire").toUpperCase();
  const extra = item.sources.length - 1;
  const deskCode = item.section ? DESK_CODE[item.section] ?? "" : "";

  const body = (
    <span className="block min-w-0">
      <span className="pw-mono block text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--pw-ink-dim)]">
        {istClock(item.publishedAt)}
        {showSection && deskCode ? ` · ${deskCode}` : ""}
        {" · "}
        <span data-testid="tile-evidence">
          {showHotSticker ? (
            <span data-testid="hot-sticker">
              {srcName}
              {extra > 0 ? ` +${extra}` : ""}
            </span>
          ) : (
            <>
              {srcName}
              {extra > 0 ? ` +${extra}` : ""}
            </>
          )}
        </span>
        {isEarly ? (
          <span data-testid="signal-early">
            {" · "}
            <span data-testid="signal-label">{signalStateLabel(state)}</span>
          </span>
        ) : null}
        {isBuilding ? (
          <span data-testid="signal-building">
            {" · "}
            <span data-testid="signal-label">{signalStateLabel(state)}</span>
          </span>
        ) : null}
        {showNewSticker ? <span data-testid="new-sticker"> · NEW</span> : null}
        {item.velocity != null && item.velocity >= 3 ? (
          <span data-testid="heat-chip" style={{ color: "var(--pw-hot)" }}>
            {" "}
            · ▲{Math.round(item.velocity * 10) / 10}
          </span>
        ) : null}
      </span>
      <span
        data-testid="tile-text"
        className={`pw-display mt-1 block text-[16px] font-semibold leading-[1.3] ${
          isEarly ? "text-[var(--pw-ink-dim)]" : "text-[var(--pw-ink)]"
        }`}
      >
        {item.text}
      </span>
      {onOpenBrief ? (
        <span
          data-testid="brief-hint"
          className="pw-mono pointer-events-none mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--pw-ink-dim)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-70"
          aria-hidden
        >
          → brief
        </span>
      ) : null}
    </span>
  );

  const className = `pw-fade-in group relative block w-full min-h-11 border-b border-[var(--pw-rule)] py-[10px] text-left last:border-b-0 ${
    clickable ? "cursor-pointer hover:bg-[var(--pw-rule)]/30" : ""
  }`;

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

  if (onOpenBrief) {
    return (
      <button
        type="button"
        className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pw-ink)]`}
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
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pw-ink)]`}
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
    // Wire rows are tone-free; tone kept for API compat.
    return { item, tone: "card" as const, mega: false };
  });
}
