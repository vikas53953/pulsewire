"use client";

import type { VibeItem, VibeResponse } from "@/lib/vibe";
import { relativeAge } from "@/lib/time";

type VibePanelProps = {
  data: VibeResponse | null;
  loading: boolean;
};

function Column({
  title,
  testId,
  items,
  empty,
}: {
  title: string;
  testId: string;
  items: VibeItem[];
  empty?: boolean;
}) {
  return (
    <div data-testid={testId} className="min-w-0 flex-1">
      <h2 className="m-0 font-mono text-[11px] font-black uppercase tracking-wide">
        {title}
      </h2>
      {empty || items.length === 0 ? (
        <p
          data-testid={`${testId}-empty`}
          className="mt-3 text-[13px] font-bold opacity-60"
        >
          Quiet on this side.
        </p>
      ) : (
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
      )}
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
    <div data-testid="vibe-panel" className="flex flex-col gap-4 sm:flex-row">
      <Column
        title="Reddit rising"
        testId="vibe-reddit"
        items={data.reddit}
        empty={data.redditEmpty}
      />
      <Column
        title="X Pulse"
        testId="vibe-xpulse"
        items={data.xpulse}
        empty={data.xEmpty}
      />
    </div>
  );
}
