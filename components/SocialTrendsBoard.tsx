"use client";

import { relativeAge } from "@/lib/time";
import type { SocialTrendsPack, TrendItem, TrendPlane } from "@/lib/types";
import { sectionLabel } from "@/lib/types";

type SocialTrendsBoardProps = {
  pack: SocialTrendsPack | null | undefined;
  loading?: boolean;
};

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
    <div data-testid={testId} data-status={status} className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="m-0 font-mono text-[11px] font-black uppercase tracking-[0.1em]">
          {title}
        </h3>
        {status === "ok" && items.length > 0 ? (
          <span
            data-testid={`${testId}-count`}
            className="font-mono text-[10px] font-bold opacity-50"
          >
            {items.length}
          </span>
        ) : null}
      </div>

      {status === "pending" ? (
        <p className="m-0 text-[12px] font-bold opacity-45">Loading…</p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={`${testId}-failed`}
          className="m-0 text-[12px] font-bold text-[var(--mega)]"
        >
          {note || "Fetch failed"}
        </p>
      ) : null}

      {status === "quiet" || (status === "ok" && items.length === 0) ? (
        <p
          data-testid={`${testId}-quiet`}
          className="m-0 text-[12px] font-bold opacity-45"
        >
          {note || emptyHint}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {items.map((item) => (
            <li key={`${item.plane}-${item.url}-${item.title.slice(0, 24)}`}>
              <a
                href={item.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                <span className="block text-[13px] font-black leading-snug text-[var(--ink)]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide opacity-50">
                  {item.source}
                  {item.section ? ` · ${sectionLabel(item.section)}` : ""}
                  {" · "}
                  {relativeAge(item.publishedAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Full Reddit + X trends — all categories, not desk-filtered.
 * Items already shown in the lean mix strip are excluded (no duplicacy).
 */
export function SocialTrendsBoard({ pack, loading }: SocialTrendsBoardProps) {
  if (loading && !pack) {
    return (
      <section
        data-testid="social-trends"
        className="border-t-2 border-[var(--ink)] pt-4"
        aria-busy
      >
        <p className="m-0 font-mono text-[10px] font-black uppercase tracking-wide opacity-45">
          Loading trends…
        </p>
      </section>
    );
  }

  if (!pack) return null;

  return (
    <section
      data-testid="social-trends"
      aria-label="All trending on Reddit and X"
      className="border-t-2 border-[var(--ink)] pt-4"
    >
      <p className="m-0 mb-3 font-mono text-[10px] font-black uppercase tracking-[0.12em] opacity-55">
        Trends · all Reddit · all X
      </p>
      <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
        <Column
          title="Trending on Reddit"
          testId="social-trends-reddit"
          plane={pack.reddit}
          emptyHint="Quiet on Reddit"
        />
        <Column
          title="Trending on X"
          testId="social-trends-x"
          plane={pack.x}
          emptyHint="Quiet on X"
        />
      </div>
    </section>
  );
}
