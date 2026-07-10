"use client";

import { relativeAge } from "@/lib/time";
import type { SectionId, TrendItem, TrendPack, TrendPlane } from "@/lib/types";
import { sectionLabel } from "@/lib/types";

type TrendStripProps = {
  trend: TrendPack | null | undefined;
  /** Active desk chip — strip is hidden on ALL. */
  section: SectionId;
  loading?: boolean;
};

function PlaneColumn({
  title,
  testId,
  plane,
}: {
  title: string;
  testId: string;
  plane: TrendPlane | undefined;
}) {
  const status = plane?.status ?? "pending";
  const items: TrendItem[] = plane?.items ?? [];
  const note = plane?.note;

  return (
    <div data-testid={testId} data-status={status} className="min-w-0 flex-1">
      <h3 className="m-0 font-mono text-[10px] font-black uppercase tracking-[0.1em] opacity-70">
        {title}
      </h3>

      {status === "pending" ? (
        <p className="mt-1.5 text-[12px] font-bold opacity-45">…</p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={`${testId}-failed`}
          className="mt-1.5 text-[12px] font-bold text-[var(--mega)]"
        >
          {note || "Fetch failed"}
        </p>
      ) : null}

      {status === "quiet" || (status === "ok" && items.length === 0) ? (
        <p
          data-testid={`${testId}-quiet`}
          className="mt-1.5 text-[12px] font-bold opacity-45"
        >
          {note || "Quiet"}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="mt-1.5 list-none space-y-1.5 p-0">
          {items.map((item) => (
            <li key={`${item.plane}-${item.url}-${item.title.slice(0, 20)}`}>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  <span className="block text-[12px] font-black leading-snug text-[var(--ink)]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide opacity-50">
                    {item.source} · {relativeAge(item.publishedAt)}
                  </span>
                </a>
              ) : (
                <div>
                  <span className="block text-[12px] font-black leading-snug">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase opacity-50">
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
 * Desk-scoped mix: only when a section chip is active (not ALL).
 * Reddit/X columns follow that desk — no global dump.
 */
export function TrendStrip({ trend, section, loading }: TrendStripProps) {
  // Overview / special tabs — mix lives on a content desk chip only.
  if (
    section === "all" ||
    section === "xpulse" ||
    section === "vibe" ||
    section === "radar"
  ) {
    return null;
  }

  if (loading && !trend) {
    return (
      <div
        data-testid="trend-strip"
        className="border-y-2 border-[var(--ink)] py-3"
        aria-busy
      >
        <p className="m-0 font-mono text-[10px] font-black uppercase tracking-wide opacity-45">
          Loading {sectionLabel(section)} mix…
        </p>
      </div>
    );
  }

  if (!trend) return null;

  const label = sectionLabel(section);

  return (
    <section
      data-testid="trend-strip"
      data-section={section}
      aria-label={`${label} mix from wires, Reddit, and X`}
      className="border-y-2 border-[var(--ink)] py-3"
    >
      <p className="m-0 mb-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] opacity-55">
        {label} · wires · reddit · x
      </p>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 min-[480px]:gap-4">
        <PlaneColumn title="On wires" testId="trend-wires" plane={trend.wires} />
        <PlaneColumn
          title="On Reddit"
          testId="trend-reddit"
          plane={trend.reddit}
        />
        <PlaneColumn title="On X" testId="trend-x" plane={trend.x} />
      </div>
    </section>
  );
}
