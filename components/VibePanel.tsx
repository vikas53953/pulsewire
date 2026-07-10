"use client";

import type { VibeColumn, VibeItem, VibeResponse } from "@/lib/vibe";
import { relativeAge } from "@/lib/time";

type VibePanelProps = {
  data: VibeResponse | null;
  loading: boolean;
};

function statusTestId(testId: string, status: VibeColumn["status"]): string {
  return `${testId}-state-${status}`;
}

function Column({
  title,
  testId,
  column,
}: {
  title: string;
  testId: string;
  column: VibeColumn | undefined;
}) {
  const status = column?.status ?? "pending";
  const items: VibeItem[] = column?.items ?? [];
  const note = column?.note;

  return (
    <div data-testid={testId} data-status={status} className="min-w-0 flex-1">
      <h2 className="m-0 font-mono text-[11px] font-black uppercase tracking-wide">
        {title}
      </h2>

      {status === "pending" ? (
        <p
          data-testid={statusTestId(testId, "pending")}
          className="mt-3 text-[13px] font-bold opacity-60"
        >
          Not fetched yet
        </p>
      ) : null}

      {status === "needs_key" ? (
        <p
          data-testid={statusTestId(testId, "needs_key")}
          className="mt-3 text-[13px] font-bold text-[var(--mega)]"
        >
          {note || "Needs LLM_API_KEY — X Pulse has never fetched (0 calls)."}
        </p>
      ) : null}

      {status === "failed" ? (
        <p
          data-testid={statusTestId(testId, "failed")}
          className="mt-3 text-[13px] font-bold text-[var(--mega)]"
        >
          {note || "Fetch failed"}
        </p>
      ) : null}

      {status === "quiet" ? (
        <p
          data-testid={statusTestId(testId, "quiet")}
          className="mt-3 text-[13px] font-bold opacity-60"
        >
          {note || "Quiet — fetched, nothing trending."}
        </p>
      ) : null}

      {status === "ok" && items.length > 0 ? (
        <ul className="mt-3 list-none space-y-2 p-0">
          {items.map((item) => (
            <li key={`${item.column}-${item.url}-${item.title.slice(0, 24)}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pw-tile block bg-[var(--card)] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                <span className="block text-[13px] font-black leading-snug">
                  {item.title}
                </span>
                <span className="mt-2 block text-[10px] font-bold uppercase opacity-60">
                  {item.source} · {relativeAge(item.publishedAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {status === "ok" && items.length === 0 ? (
        <p
          data-testid={statusTestId(testId, "quiet")}
          className="mt-3 text-[13px] font-bold opacity-60"
        >
          {note || "Quiet — fetched, nothing trending."}
        </p>
      ) : null}

      {note && status === "ok" && items.length > 0 ? (
        <p
          data-testid={`${testId}-note`}
          className="mt-2 font-mono text-[10px] uppercase opacity-50"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function VibePanel({ data, loading }: VibePanelProps) {
  if (loading || !data) {
    return (
      <div data-testid="vibe-panel" className="pw-tile bg-[var(--card)] p-4">
        <p className="m-0 font-mono text-[12px] uppercase opacity-60">
          Loading vibe…
        </p>
      </div>
    );
  }

  return (
    <div data-testid="vibe-panel" className="flex flex-col gap-3">
      <p className="m-0 text-[12px] font-bold opacity-70">
        What&apos;s loud on Reddit vs X right now — not a feed to scroll.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Column title="On X" testId="vibe-xpulse" column={data.xpulse} />
        <Column title="On Reddit" testId="vibe-reddit" column={data.reddit} />
      </div>
    </div>
  );
}
