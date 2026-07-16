"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "@/lib/market";
import type { HighlightsResponse } from "@/lib/types";

function RailCard({
  title,
  children,
  testId,
  alert = false,
}: {
  title: string;
  children: React.ReactNode;
  testId: string;
  alert?: boolean;
}) {
  return (
    <section
      data-testid={testId}
      className={`pw-card px-4 py-3 ${
        alert
          ? "border-dashed border-[var(--pw-unk-alert,var(--pw-hot))]"
          : ""
      }`}
    >
      <h2 className="pw-mono m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pw-dim)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Feeds reporting vs configured. Blind ≠ quiet: when feeds are down it flips to
 * the dashed unknown treatment, never a calm "all good". */
export function SourceHealth({
  health,
  blind = false,
}: {
  health?: HighlightsResponse["sourceHealth"];
  blind?: boolean;
}) {
  if (!health) return null;
  const { reporting, total } = health;
  const allUp = reporting >= total && !blind;

  if (blind || reporting === 0) {
    return (
      <RailCard title="Source health" testId="source-health" alert>
        <p className="pw-display m-0 text-[13px] font-semibold text-[var(--pw-hot)]">
          Feeds unreachable — status unknown
        </p>
      </RailCard>
    );
  }

  return (
    <RailCard title="Source health" testId="source-health">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: allUp ? "var(--pw-quiet)" : "var(--pw-warm)" }}
        />
        <span className="pw-display text-[13px] font-semibold text-[var(--pw-ink)]">
          {reporting} of {total} feeds reporting
        </span>
      </div>
      {!allUp && health.down.length > 0 ? (
        <p className="pw-mono m-0 mt-1 truncate text-[11px] text-[var(--pw-dim)]">
          down: {health.down.slice(0, 3).join(", ")}
          {health.down.length > 3 ? ` +${health.down.length - 3}` : ""}
        </p>
      ) : null}
    </RailCard>
  );
}

/** Consecutive quiet mornings — green = earned quiet. Hidden while calibrating
 * (streak null) so we never fake a run. */
export function QuietStreak({
  streak,
}: {
  streak?: HighlightsResponse["quietStreak"];
}) {
  if (!streak || streak.streak < 2) return null;
  const n = streak.streak;
  const ord = n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
  return (
    <RailCard title="Quiet streak" testId="quiet-streak">
      <p className="pw-display m-0 text-[15px] font-bold text-[var(--pw-success)]">
        {ord} quiet morning in a row
      </p>
      {streak.quietestSince ? (
        <p className="pw-mono m-0 mt-1 text-[11px] text-[var(--pw-dim)]">
          quietest hour since {streak.quietestSince}
        </p>
      ) : null}
    </RailCard>
  );
}

/** Nifty / Sensex / USD-INR — real Yahoo data, delayed + timestamped. Market
 * up/down colour is subordinate (tiny mono) so a red index never competes with
 * a red desk status. */
export function MarketSnapshotWidget() {
  const [snap, setSnap] = useState<MarketSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as MarketSnapshot;
        if (alive) {
          setSnap(data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const asOfLabel = snap?.asOf
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(snap.asOf))
    : null;

  const unreachable = failed || (snap != null && !snap.ok);

  return (
    <RailCard title="Market snapshot" testId="market-snapshot">
      {snap == null && !failed ? (
        <p className="pw-mono m-0 text-[11px] text-[var(--pw-dim)]">Loading…</p>
      ) : unreachable ? (
        <p
          data-testid="market-unreachable"
          className="pw-mono m-0 text-[12px] text-[var(--pw-dim)]"
        >
          Quotes unreachable — not live right now.
        </p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {snap!.quotes.map((q) => {
              const up = q.changePct >= 0;
              return (
                <li
                  key={q.label}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="pw-mono text-[11px] uppercase tracking-[0.06em] text-[var(--pw-dim)]">
                    {q.label}
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="pw-mono pw-tabular text-[13px] font-semibold text-[var(--pw-ink)]">
                      {q.price.toLocaleString("en-IN")}
                    </span>
                    <span
                      className="pw-mono text-[10px]"
                      style={{
                        color: up ? "var(--pw-success)" : "var(--pw-hot)",
                      }}
                    >
                      {up ? "▲" : "▼"}
                      {Math.abs(q.changePct).toFixed(1)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="pw-mono m-0 mt-2 text-[10px] text-[var(--pw-dim)]">
            delayed{asOfLabel ? ` · ${asOfLabel} IST` : ""}
          </p>
        </>
      )}
    </RailCard>
  );
}
