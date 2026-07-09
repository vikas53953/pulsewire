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
};

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
}: HighlightTileProps) {
  const href = item.sources[0]?.url;
  const clickable = Boolean(href);
  const { bg, fg } = toneStyles(tone);
  const sourceNames = item.sources.map((s) => s.name);
  const showSticker = mega && item.hot && item.sources.length >= 2;

  const body = (
    <>
      {showSticker ? (
        <span className="absolute -top-2.5 right-2.5 z-10">
          <Sticker>{`🔥 ${item.sources.length} SOURCES`}</Sticker>
        </span>
      ) : null}

      <p
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
      </p>
    </>
  );

  const className = `pw-tile pw-fade-in relative block p-4 ${
    mega ? "min-h-[140px]" : "min-h-[120px]"
  } ${clickable ? "" : "pw-tile--dead"}`;

  if (!clickable) {
    return (
      <div className={className} style={{ background: bg }} aria-disabled>
        {body}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ background: bg, color: fg }}
    >
      {body}
    </a>
  );
}

/** Deterministic bento assignment per design brief §3. */
export function assignTileTones(
  items: HighlightItem[]
): { item: HighlightItem; tone: TileTone; mega: boolean }[] {
  const sorted = [...items].sort((a, b) => {
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
