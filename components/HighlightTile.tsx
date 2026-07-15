"use client";

import { signalStateLabel } from "@/lib/fusion";
import { distinctPublisherCount } from "@/lib/publisher";
import { relativeAge } from "@/lib/time";
import type { HighlightItem } from "@/lib/types";
import { sectionLabel } from "@/lib/types";

export type TileTone = "mega" | "teal" | "lav" | "card";

type HighlightTileProps = {
  item: HighlightItem;
  tone: TileTone;
  showSection: boolean;
  mega?: boolean;
  index?: number;
  /** v3.1 Brief — tap opens overlay instead of navigating away. */
  onOpenBrief?: (item: HighlightItem) => void;
  /** Unknown state: stale post treatment (spec §4.4). */
  stale?: boolean;
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

/** Source initials for the avatar (spec §4.4). */
function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "W";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const LEVEL_COLOR: Record<string, string> = {
  green: "var(--pw-quiet)",
  yellow: "var(--pw-warm)",
  red: "var(--pw-hot)",
};

/**
 * MORNING FEED post card (spec §4.4): a post *from the source* — avatar,
 * source name, mono meta; the engagement row is replaced by evidence.
 */
export function HighlightTile({
  item,
  tone: _tone,
  showSection,
  mega = false,
  index = 0,
  onOpenBrief,
  stale = false,
}: HighlightTileProps) {
  const href = item.sources[0]?.url;
  const clickable = Boolean(href) || Boolean(onOpenBrief);
  const showHotSticker = mega && item.hot && item.sources.length >= 2;
  const showNewSticker = Boolean(item.isNew);
  const testId = tileTestId(item, index);
  const state = item.signalState ?? "confirmed";
  const isEarly = state === "early";
  const isBuilding = state === "building";
  const srcName = item.sources[0]?.name || "wire";
  // Independent publishers, not feed rows — one outlet never counts twice.
  const n = Math.max(1, distinctPublisherCount(item.sources));
  const levelColor = item.hot
    ? LEVEL_COLOR.red
    : n >= 2
      ? LEVEL_COLOR.yellow
      : "var(--pw-dim)";

  const body = (
    <span className="block min-w-0 px-4 py-[14px] sm:px-5 sm:py-5">
      {/* Post header: avatar · source · meta */}
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className="pw-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pw-av)] text-[13px] font-bold text-[var(--pw-dim)]"
        >
          {initials(srcName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="pw-display block truncate text-[15px] font-semibold text-[var(--pw-ink)]">
            {srcName}
          </span>
          <span className="pw-mono block text-[12px] text-[var(--pw-dim)]">
            <span data-testid="tile-evidence">
              {showHotSticker ? (
                <span data-testid="hot-sticker">
                  +{n - 1} source{n - 1 === 1 ? "" : "s"}
                </span>
              ) : n > 1 ? (
                `+${n - 1} source${n - 1 === 1 ? "" : "s"}`
              ) : (
                "single source"
              )}
            </span>
            {" · "}
            {stale ? `as of ${relativeAge(item.publishedAt)}` : relativeAge(item.publishedAt)}
            {showNewSticker ? (
              <span data-testid="new-sticker" style={{ color: "var(--pw-success)" }}>
                {" "}
                · new
              </span>
            ) : null}
          </span>
        </span>
      </span>

      {/* Headline */}
      <span
        data-testid="tile-text"
        className={`pw-display mt-3 block text-[15px] font-medium leading-[1.4] sm:text-[20px] ${
          isEarly ? "text-[var(--pw-dim)]" : "text-[var(--pw-ink)]"
        }`}
        style={{ textWrap: "pretty" } as React.CSSProperties}
      >
        {item.text}
      </span>

      {/* Evidence row — replaces the engagement row */}
      <span className="pw-mono mt-3 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--pw-dim)] sm:text-[13px]">
        <span style={{ color: levelColor }}>◉</span>
        {showSection && item.section ? (
          <span>{sectionLabel(item.section)}</span>
        ) : null}
        <span>
          {n} source{n === 1 ? "" : "s"} {n > 1 ? "agree" : ""}
        </span>
        {isEarly ? (
          <span data-testid="signal-early" style={{ color: "var(--pw-warm)" }}>
            <span data-testid="signal-label">{signalStateLabel(state)}</span>
          </span>
        ) : null}
        {isBuilding ? (
          <span
            data-testid="signal-building"
            style={{ color: "var(--pw-warm)" }}
          >
            <span data-testid="signal-label">{signalStateLabel(state)}</span>
          </span>
        ) : null}
        {item.velocity != null && item.velocity >= 3 ? (
          <span data-testid="heat-chip" style={{ color: "var(--pw-hot)" }}>
            ▲{Math.round(item.velocity * 10) / 10}/hr
          </span>
        ) : null}
        {onOpenBrief ? (
          <span
            data-testid="brief-hint"
            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-60"
            aria-hidden
          >
            → brief
          </span>
        ) : null}
      </span>
    </span>
  );

  const className = `pw-card pw-fade-in group relative block w-full min-h-11 text-left transition-[border-color] duration-[120ms] ${
    clickable ? "cursor-pointer hover:border-[var(--pw-dim)]" : ""
  } ${stale ? "opacity-55" : ""}`;

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
        className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]`}
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
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)]`}
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
    // Post cards are tone-free; tone kept for API compat.
    return { item, tone: "card" as const, mega: false };
  });
}
