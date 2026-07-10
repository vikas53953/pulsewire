"use client";

import { useEffect, useId } from "react";
import type { BriefPayload } from "@/lib/brief";

type BriefOverlayProps = {
  open: boolean;
  loading: boolean;
  brief: BriefPayload | null;
  onClose: () => void;
};

export function BriefOverlay({
  open,
  loading,
  brief,
  onClose,
}: BriefOverlayProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const primary = brief?.sources?.[0];

  return (
    <div
      data-testid="brief-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="pw-tile relative w-full max-w-lg bg-[var(--card)] p-4 shadow-[6px_6px_0_var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="brief-close"
          className="absolute right-3 top-3 min-h-11 min-w-11 font-mono text-[12px] font-black uppercase"
          onClick={onClose}
        >
          Close
        </button>

        <p
          id={titleId}
          data-testid="brief-title"
          className="m-0 pr-16 text-[18px] font-black leading-tight text-[var(--ink)]"
        >
          {brief?.title ?? (loading ? "Loading brief…" : "Brief")}
        </p>

        {loading ? (
          <p className="mt-4 font-mono text-[12px] uppercase opacity-60">
            Fetching…
          </p>
        ) : null}

        {!loading && brief?.rawMode ? (
          <div data-testid="brief-raw" className="mt-4 space-y-2">
            <p className="m-0 text-[12px] font-bold uppercase tracking-wide opacity-60">
              RAW — title + sources only
            </p>
            <ul className="m-0 list-none space-y-1 p-0">
              {(brief.sources || []).map((s) => (
                <li key={`${s.name}-${s.url}`} className="text-[13px] font-bold">
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && brief?.lines ? (
          <dl data-testid="brief-lines" className="mt-4 space-y-3">
            {(
              [
                ["What happened", brief.lines.whatHappened, "brief-what"],
                ["Why it matters", brief.lines.whyItMatters, "brief-why"],
                ["Who's affected", brief.lines.whosAffected, "brief-who"],
                ["What's next", brief.lines.whatsNext, "brief-next"],
              ] as const
            ).map(([label, value, testId]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] font-black uppercase tracking-wide opacity-60">
                  {label}
                </dt>
                <dd
                  data-testid={testId}
                  className="m-0 mt-1 text-[14px] font-bold leading-snug text-[var(--ink)]"
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {primary?.url ? (
          <a
            data-testid="brief-source-link"
            href={primary.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center border-2 border-[var(--ink)] bg-[var(--sticker)] px-3 font-mono text-[12px] font-black uppercase shadow-[3px_3px_0_var(--shadow)]"
          >
            Open source →
          </a>
        ) : null}

        {brief?.cached ? (
          <p
            data-testid="brief-cached"
            className="mt-3 font-mono text-[10px] uppercase opacity-50"
          >
            Cached
          </p>
        ) : null}
      </div>
    </div>
  );
}
