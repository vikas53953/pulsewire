"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";

type SideNavProps = {
  active: "today" | "trend";
  onToday: () => void;
  onTrend: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  /** Change (e.g. generatedAt) to replay the logo refresh ping. */
  pulseKey?: string | number;
  /** Desktop rail widgets (time control, leaderboard) — mounted only at xl. */
  extras?: ReactNode;
};

function istClock(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(now)} IST`;
}

/**
 * SIGNAL BLACK nav rail (spec §4): brand block, pill-hover nav rows, blue
 * Refresh pill (blue = brand/action only, never status), product block at
 * the bottom. Not-yet items are visibly "soon" — never dead links.
 */
export function SideNav({
  active,
  onToday,
  onTrend,
  onRefresh,
  refreshing = false,
  pulseKey,
  extras,
}: SideNavProps) {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const tick = () => setClock(istClock(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const item = (selected: boolean, disabled = false) =>
    `pw-display flex w-full min-h-[48px] items-center gap-2 rounded-full px-4 py-2 text-left text-[18px] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent)] ${
      disabled
        ? "cursor-default font-medium text-[var(--pw-dim)] opacity-50"
        : selected
          ? "font-bold text-[var(--pw-ink)]"
          : "font-medium text-[var(--pw-dim)] hover:bg-[var(--pw-panel)] hover:text-[var(--pw-ink)]"
    }`;

  return (
    // The whole rail scrolls as one column when content is tall — no fragile
    // inner scroll region, so widgets can never clip behind the refresh button.
    <nav
      data-testid="side-nav"
      aria-label="PulseWire navigation"
      className="pw-no-scrollbar sticky top-0 hidden max-h-screen flex-col overflow-y-auto py-5 pr-4 xl:flex"
    >
      <div className="mb-5 flex items-center px-2">
        <button
          type="button"
          onClick={onToday}
          aria-label="PulseWire — go to Today"
          className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent)]"
        >
          <Logo size={40} pulse={pulseKey} />
        </button>
      </div>

      <button type="button" className={item(active === "today")} onClick={onToday}>
        Today
      </button>
      <button type="button" className={item(active === "trend")} onClick={onTrend}>
        Trend
      </button>
      <span className={item(false, true)} aria-disabled title="History — coming with the baseline archive">
        History
        <span className="pw-mono text-[10px] uppercase tracking-[0.08em]">soon</span>
      </span>

      {/* Primary action stays high so it's always reachable without scrolling. */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        data-testid="rail-refresh"
        className="pw-display mt-3 min-h-[46px] w-full rounded-full bg-[var(--pw-accent)] px-4 text-[15px] font-bold text-white transition-opacity duration-[120ms] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent)] disabled:opacity-50"
      >
        {refreshing ? "Refreshing…" : "Refresh now"}
      </button>

      {extras ? (
        <div className="mt-5 flex flex-col divide-y divide-[var(--pw-line)]">
          {extras}
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3 border-t border-[var(--pw-line)] px-2 pt-4">
        <Logo size={34} />
        <span className="min-w-0">
          <span className="pw-display block text-[14px] font-semibold text-[var(--pw-ink)]">
            PulseWire
          </span>
          <span
            className="pw-mono block text-[11px] text-[var(--pw-dim)]"
            suppressHydrationWarning
          >
            new delhi · {clock}
          </span>
        </span>
      </div>
    </nav>
  );
}
