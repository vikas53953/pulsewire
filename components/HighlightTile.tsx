"use client";

import { Sticker } from "@/components/Sticker";
import { formatSources, relativeAge } from "@/lib/time";
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
  const sourceNames = item.sources.map((s) => s.name);
  const showHotSticker = mega && item.hot && item.sources.length >= 2;
  const showNewSticker = Boolean(item.isNew);
  const testId = tileTestId(item, index);

  const body = (
    <>
      {(showHotSticker || showNewSticker) && (
        <span className="absolute -top-2.5 right-2.5 z-10 flex flex-col items-end gap-1">
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
        className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ color: fg, opacity: 0.75 }}
      >
        {formatSources(sourceNames)}
        {" · "}
        {relativeAge(item.publishedAt)}
        {showSection && item.section ? ` · ${item.section}` : ""}
        {item.velocity != null && item.velocity >= 3 ? (
          <span data-testid="heat-chip">
            {" · "}▲ {item.velocity} src
            {item.sources.length >= 2
              ? `/${Math.max(
                  1,
                  Math.round(
                    (Math.max(
                      ...item.sources.map((s) =>
                        new Date(s.firstSeen || item.publishedAt).getTime()
                      )
                    ) -
                      Math.min(
                        ...item.sources.map((s) =>
                          new Date(s.firstSeen || item.publishedAt).getTime()
                        )
                      )) /
                      60_000
                  )
                )}m`
              : ""}
          </span>
        ) : null}
      </p>
    </>
  );

  const className = `pw-tile pw-fade-in relative block p-4 ${
    mega ? "min-h-[140px]" : "min-h-[120px]"
  } ${clickable ? "" : "pw-tile--dead"}`;

  const dataAttrs = {
    "data-testid": testId,
    "data-tile": "highlight",
    "data-section": item.section ?? "",
    "data-hot": item.hot ? "1" : "0",
    "data-mega": mega ? "1" : "0",
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
