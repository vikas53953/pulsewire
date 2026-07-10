"use client";

import { relativeAge } from "@/lib/time";
import type { TrendItem, TrendPack, TrendPlane } from "@/lib/types";

type TrendStripProps = {
  trend: TrendPack | null | undefined;
  loading?: boolean;
};

function PlaneColumn({
  title,
  testId,
  plane,
  accent,
}: {
  title: string;
  testId: string;
  plane: TrendPlane | undefined;
  accent: string;
}) {
  const status = plane?.status ?? "pending";
  const items: TrendItem[] = plane?.items ?? [];
  const note = plane?.note;

  return (
    <div
      data-testid={testId}
      data-status={status}
      className="min-w-0 flex-1 border-t-2 border-[var(--ink)] pt-2 sm:border-t-0 sm:border-l-2 sm:pl-3 sm:pt-0 first:border-l-0 first:pl-0 first:pt-0 first:border-t-0"
    >
      <h3
        className="m-0 font-mono text-[11px] font-black uppercase tracking-[0.08em]"
        style={{ color: accent }}
      >
        {title}
      </h3>

      {status === "pending" ? (
        <p className="mt-2 text-[12px] font-bold opacity-50">Not fetched yet</p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={`${testId}-failed`}
          className="mt-2 text-[12px] font-bold text-[var(--mega)]"
        >
          {note || "Fetch failed"}
        </p>
      ) : null}

      {status === "quiet" || (status === "ok" && items.length === 0) ? (
        <p
          data-testid={`${testId}-quiet`}
          className="mt-2 text-[12px] font-bold opacity-55"
        >
          {note || "Quiet"}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="mt-2 list-none space-y-2 p-0">
          {items.map((item) => (
            <li key={`${item.plane}-${item.url}-${item.title.slice(0, 20)}`}>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  <span className="block text-[13px] font-black leading-snug text-[var(--ink)]">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide opacity-55">
                    {item.source} · {relativeAge(item.publishedAt)}
                  </span>
                </a>
              ) : (
                <div>
                  <span className="block text-[13px] font-black leading-snug">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase opacity-55">
                    {item.source} · {relativeAge(item.publishedAt)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Mix-and-match strip: On wires · On Reddit · On X.
 * Always visible so social fetch isn't invisible when titles don't fuse.
 */
export function TrendStrip({ trend, loading }: TrendStripProps) {
  if (loading && !trend) {
    return (
      <div
        data-testid="trend-strip"
        className="pw-tile bg-[var(--card)] p-4"
        aria-busy
      >
        <p className="m-0 font-mono text-[11px] font-black uppercase tracking-wide opacity-50">
          Loading mix…
        </p>
      </div>
    );
  }

  if (!trend) return null;

  return (
    <section
      data-testid="trend-strip"
      aria-label="Mix from wires, Reddit, and X"
      className="pw-tile bg-[var(--card)] p-4"
    >
      <p className="m-0 mb-3 font-mono text-[10px] font-black uppercase tracking-[0.1em] opacity-60">
        Trend · mix from three planes
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
        <PlaneColumn
          title="On wires"
          testId="trend-wires"
          plane={trend.wires}
          accent="var(--ink)"
        />
        <PlaneColumn
          title="On Reddit"
          testId="trend-reddit"
          plane={trend.reddit}
          accent="var(--ink)"
        />
        <PlaneColumn
          title="On X"
          testId="trend-x"
          plane={trend.x}
          accent="var(--ink)"
        />
      </div>
    </section>
  );
}
