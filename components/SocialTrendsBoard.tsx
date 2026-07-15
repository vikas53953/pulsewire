"use client";

import { relativeAge } from "@/lib/time";
import type { SocialTrendsPack, TrendItem, TrendPlane } from "@/lib/types";
import { sectionLabel } from "@/lib/types";
import { trendAccentFromVelocity } from "@/lib/social-velocity-math";

type SocialTrendsBoardProps = {
  pack: SocialTrendsPack | null | undefined;
  loading?: boolean;
};

/** Collapsed X copy — never claim quiet when blind or broken. */
export function xCollapsedCopy(
  status: TrendPlane["status"] | undefined,
): string {
  switch (status) {
    case "needs_key":
      return "Reddit only — X not configured";
    case "failed":
      return "X errored — not quiet";
    case "pending":
      return "X pending — not quiet yet";
    default:
      return "X quiet — no earned pulse right now.";
  }
}

/** Velocity-earned accent — color = status, never decoration. */
export function trendAccent(
  velocity: number | undefined,
  ratio?: number | null,
): "hot" | "warm" | "none" {
  return trendAccentFromVelocity(velocity, ratio ?? null);
}

function TrendTile({ item }: { item: TrendItem }) {
  const accent = trendAccent(item.velocity, item.velocityRatio);
  const border =
    accent === "hot"
      ? "border-l-[3px] border-l-[var(--pw-hot)]"
      : accent === "warm"
        ? "border-l-[3px] border-l-[var(--pw-warm)]"
        : "border-l-[3px] border-l-transparent";

  return (
    <li>
      <a
        href={item.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="trend-tile"
        data-accent={accent}
        data-velocity={item.velocity ?? 0}
        className={`block border-b border-dotted border-[var(--pw-rule)] py-[10px] pl-2 text-left last:border-b-0 hover:bg-[var(--pw-rule)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pw-ink)] ${border}`}
      >
        <span className="pw-mono block text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--pw-ink-dim)]">
          {item.source}
          {item.section ? ` · ${sectionLabel(item.section)}` : ""}
          {" · "}
          {relativeAge(item.publishedAt)}
        </span>
        <span className="pw-display mt-1 block text-[14px] font-semibold leading-snug text-[var(--pw-ink)]">
          {item.title}
        </span>
        {item.why ? (
          <span
            data-testid="trend-why"
            className="pw-mono mt-1 block text-[11px] normal-case leading-[1.5] tracking-normal text-[var(--pw-ink-dim)]"
          >
            {item.why}
          </span>
        ) : null}
      </a>
    </li>
  );
}

function Column({
  title,
  testId,
  plane,
  emptyHint,
}: {
  title: string;
  testId: string;
  plane: TrendPlane | undefined;
  emptyHint: string;
}) {
  const status = plane?.status ?? "pending";
  const items: TrendItem[] = plane?.items ?? [];
  const note = plane?.note;

  return (
    <div data-testid={testId} data-status={status} className="min-w-0">
      <h2 className="pw-mono m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-ink-dim)]">
        {title}
        {status === "ok" && items.length > 0 ? (
          <span
            data-testid={`${testId}-count`}
            className="ml-2 font-normal opacity-45"
          >
            {items.length}
          </span>
        ) : null}
      </h2>

      {status === "pending" ? (
        <p className="pw-mono m-0 text-[11px] leading-[1.6] text-[var(--pw-ink-dim)]">Loading…</p>
      ) : null}

      {status === "needs_key" ? (
        <p
          data-testid={`${testId}-needs-key`}
          className="pw-mono m-0 text-[11px] leading-[1.6] text-[var(--pw-ink-dim)]"
        >
          {note || "X plane off — no API key configured"}
        </p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={`${testId}-failed`}
          className="pw-mono m-0 text-[11px] leading-[1.6] text-[var(--pw-hot)]"
        >
          {note || "Fetch failed — not quiet"}
        </p>
      ) : null}

      {status === "quiet" || (status === "ok" && items.length === 0) ? (
        <p
          data-testid={`${testId}-quiet`}
          className="pw-mono m-0 text-[11px] leading-[1.6] text-[var(--pw-ink-dim)]"
        >
          {note || emptyHint}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <TrendTile
              key={`${item.plane}-${item.url}-${item.title.slice(0, 24)}`}
              item={item}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Dedicated TREND panel — Reddit + X only.
 * Shown when the TREND chip is active; not under every desk.
 */
export function SocialTrendsBoard({ pack, loading }: SocialTrendsBoardProps) {
  if (loading && !pack) {
    return (
      <section data-testid="social-trends" className="py-2" aria-busy>
        <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-wide opacity-45">
          Loading trends…
        </p>
      </section>
    );
  }

  if (!pack) return null;

  const redditOk =
    pack.reddit?.status === "ok" && (pack.reddit.items?.length ?? 0) > 0;
  const xOk = pack.x?.status === "ok" && (pack.x.items?.length ?? 0) > 0;
  const xStatus = pack.x?.status ?? "quiet";
  const xUnavailable = xStatus === "needs_key";
  const dual = redditOk && xOk;
  const collapseX = redditOk && !xOk;

  return (
    <section
      data-testid="social-trends"
      aria-label={
        xUnavailable
          ? "Trending on Reddit; X not configured"
          : "Trending on Reddit and X"
      }
      className="py-1"
    >
      <div className="px-0 py-1">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="pw-display m-0 text-[16px] font-bold text-[var(--pw-ink)]">
          Trending off-platform
        </h2>
        <p className="pw-mono m-0 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--pw-ink-dim)]">
          {xUnavailable
            ? "unverified · reddit only · x not configured"
            : "unverified · reddit + x · kept off the news desks"}
        </p>
      </div>
      <div
        className={
          dual
            ? "grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10"
            : "grid grid-cols-1 gap-4"
        }
      >
        <Column
          title="On Reddit"
          testId="social-trends-reddit"
          plane={pack.reddit}
          emptyHint="Quiet on Reddit"
        />
        {collapseX ? (
          <p
            data-testid="social-trends-x"
            data-status={xStatus}
            className="pw-mono m-0 text-[11px] leading-[1.6] text-[var(--pw-ink-dim)]"
          >
            {xCollapsedCopy(xStatus)}
          </p>
        ) : (
          <Column
            title="On X"
            testId="social-trends-x"
            plane={pack.x}
            emptyHint="Quiet on X"
          />
        )}
      </div>
      </div>
    </section>
  );
}
