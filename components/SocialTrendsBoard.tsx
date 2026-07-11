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
      ? "border-l-[3px] border-l-[var(--mega)]"
      : accent === "warm"
        ? "border-l-[3px] border-l-[var(--warm)]"
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
        className={`pw-tile block bg-[var(--card)] p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${border}`}
      >
        <span className="block text-[15px] font-bold leading-snug text-[var(--ink)]">
          {item.title}
        </span>
        <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide opacity-50">
          {item.source}
          {item.section ? ` · ${sectionLabel(item.section)}` : ""}
          {" · "}
          {relativeAge(item.publishedAt)}
        </span>
        {item.why ? (
          <span
            data-testid="trend-why"
            className="mt-1 block text-[11px] font-bold normal-case tracking-normal opacity-60"
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
      <h2 className="m-0 mb-3 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
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
        <p className="m-0 text-[13px] font-bold opacity-45">Loading…</p>
      ) : null}

      {status === "needs_key" ? (
        <p
          data-testid={`${testId}-needs-key`}
          className="m-0 text-[13px] font-bold opacity-45"
        >
          {note || "X plane off — no API key configured"}
        </p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={`${testId}-failed`}
          className="m-0 text-[13px] font-bold text-[var(--mega)]"
        >
          {note || "Fetch failed — not quiet"}
        </p>
      ) : null}

      {status === "quiet" || (status === "ok" && items.length === 0) ? (
        <p
          data-testid={`${testId}-quiet`}
          className="m-0 text-[13px] font-bold opacity-45"
        >
          {note || emptyHint}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="m-0 list-none space-y-3 p-0">
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
  const dual = redditOk && xOk;
  const collapseX = redditOk && !xOk;

  return (
    <section
      data-testid="social-trends"
      aria-label="Trending on Reddit and X"
      className="py-1"
    >
      <div className="mb-5 max-w-lg">
        <h2 className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.14em] opacity-55">
          TREND
        </h2>
        <p className="m-0 mt-1 text-[13px] font-bold leading-snug opacity-65">
          High-signal Reddit and X only — kept off the news desks on purpose.
        </p>
      </div>
      <div
        className={
          dual
            ? "grid grid-cols-1 gap-8 border-t-2 border-[var(--ink)] pt-5 sm:grid-cols-2 sm:gap-12"
            : "grid grid-cols-1 gap-6 border-t-2 border-[var(--ink)] pt-5"
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
            className="m-0 text-[12px] font-bold opacity-45"
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
    </section>
  );
}
