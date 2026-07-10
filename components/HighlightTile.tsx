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

function toneStyles(tone: TileTone): { bg: string; fg: string } {
  switch (tone) {
    case "mega":
      return { bg: "var(--mega)", fg: "var(--mega-fg)" };
    case "teal":
      // Pastel accents stay light in Night Zine — always use dark ink for AA.
      return { bg: "var(--teal)", fg: "#141414" };
    case "lav":
      return { bg: "var(--lav)", fg: "#141414" };
    default:
      return { bg: "var(--card)", fg: "var(--ink)" };
  }
}

export function HighlightTile({
  item,
  tone,
  showSection,
  mega = false,
  index = 0,
  onOpenBrief,
}: HighlightTileProps) {
  const href = item.sources[0]?.url;
  const clickable = Boolean(href) || Boolean(onOpenBrief);
  const { bg, fg } = toneStyles(tone);
  const showHotSticker = mega && item.hot && item.sources.length >= 2;
  const showNewSticker = Boolean(item.isNew);
  const testId = tileTestId(item, index);
  const state = item.signalState ?? "confirmed";
  const isEarly = state === "early";
  const isBuilding = state === "building";

  const body = (
    <>
      {(showHotSticker || showNewSticker || isEarly || isBuilding) && (
        <span className="absolute -top-2.5 right-2.5 z-10 flex flex-col items-end gap-1">
          {isEarly ? (
            <span data-testid="signal-early">
              <Sticker className="!bg-[var(--card)] !text-[var(--ink)]">
                ⚡ EARLY · UNCONFIRMED
              </Sticker>
            </span>
          ) : null}
          {isBuilding ? (
            <span data-testid="signal-building">
              <Sticker className="!bg-[var(--sticker)] !text-[var(--ink)]">
                ◐ GAINING TRACTION
              </Sticker>
            </span>
          ) : null}
          {showHotSticker ? (
            <span data-testid="hot-sticker">
              <Sticker>{`🔥 ${item.sources.length} SOURCES`}</Sticker>
            </span>
          ) : null}
          {showNewSticker ? (
            <span data-testid="new-sticker">
              <Sticker className="!bg-[var(--mega)] !text-[var(--mega-fg)]">
                NEW
              </Sticker>
            </span>
          ) : null}
        </span>
      )}

      <p
        data-testid="tile-text"
        className={`m-0 font-black ${
          mega ? "text-[24px] leading-[1.15]" : "text-[14px] leading-[1.3]"
        }`}
        style={{ color: fg }}
      >
        {item.text}
      </p>

      <p
        data-testid="tile-evidence"
        className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ color: fg, opacity: 0.75 }}
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
      </p>
    </>
  );

  const className = `pw-tile pw-fade-in relative block p-4 ${
    mega ? "min-h-[140px]" : "min-h-[120px]"
  } ${clickable ? "" : "pw-tile--dead"} ${
    isEarly ? "border-dashed opacity-95" : ""
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
      <div
        className={className}
        style={{ background: bg }}
        aria-disabled
        {...dataAttrs}
      >
        {body}
      </div>
    );
  }

  // Brief opener — source link lives in the overlay footer (SPEC v3.1).
  if (onOpenBrief) {
    return (
      <button
        type="button"
        className={`${className} w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]`}
        style={{ background: bg, color: fg }}
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
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]`}
      style={{ background: bg, color: fg }}
      {...dataAttrs}
    >
      {body}
    </a>
  );
}

/** Deterministic bento assignment — mega = top heat (SPEC v2). */
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

  return sorted.map((item, index) => {
    if (index === 0) {
      return { item, tone: "mega" as const, mega: true };
    }
    if (index === 1) {
      return {
        item,
        tone: item.hot ? ("teal" as const) : ("card" as const),
        mega: false,
      };
    }
    if (index === 2) {
      return {
        item,
        tone: item.hot ? ("lav" as const) : ("card" as const),
        mega: false,
      };
    }
    return { item, tone: "card" as const, mega: false };
  });
}
