"use client";

import { useRef } from "react";

type XGov = {
  dailyUsed: number;
  dailyCap: number;
  paused?: boolean;
  pauseNote?: string | null;
};

type StatusBarProps = {
  generatedAt: string | null;
  lastVisit?: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  /** Long-press / deep refresh — earns one x_search (M8). */
  onDeepRefresh?: () => void;
  xPulseUsage?: {
    month: string;
    used: number;
    cap: number;
    dailyUsed?: number;
    dailyCap?: number;
    paused?: boolean;
  };
  xGovernor?: XGov | null;
};

function leftLabel(lastVisit: number | null | undefined): string | null {
  if (lastVisit == null) return null;
  const mins = Math.max(0, Math.round((Date.now() - lastVisit) / 60_000));
  if (mins < 1) return "you left just now";
  if (mins < 60) return `you left ${mins}m ago`;
  return `you left ${Math.round(mins / 60)}h ago`;
}

export function StatusBar({
  generatedAt: _generatedAt,
  lastVisit,
  refreshing,
  onRefresh,
  onDeepRefresh,
  xPulseUsage,
  xGovernor,
}: StatusBarProps) {
  const left = leftLabel(lastVisit);
  const dailyUsed = xGovernor?.dailyUsed ?? xPulseUsage?.dailyUsed;
  const dailyCap = xGovernor?.dailyCap ?? xPulseUsage?.dailyCap;
  const paused = Boolean(xGovernor?.paused ?? xPulseUsage?.paused);
  const pauseNote =
    xGovernor?.pauseNote ||
    (paused
      ? "⚡ early-signal plane paused (daily budget) — wires & Reddit still live."
      : null);
  void dailyUsed;
  void dailyCap;
  void _generatedAt;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepFired = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const startPress = () => {
    clearPress();
    deepFired.current = false;
    if (!onDeepRefresh) return;
    pressTimer.current = setTimeout(() => {
      deepFired.current = true;
      onDeepRefresh();
    }, 650);
  };

  return (
    <footer className="pw-mono flex min-h-[48px] flex-col items-center gap-2 border-t-[3px] border-[var(--pw-rule-strong)] pt-3 text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--pw-ink-dim)]">
      {pauseNote ? (
        <p
          data-testid="x-plane-paused"
          className="m-0 max-w-md text-center text-[12px] font-bold normal-case tracking-normal text-[var(--mega)]"
        >
          {pauseNote}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span data-testid="status-updated">
          {left ? `${left} · ` : ""}
          auto-refresh 10 min
        </span>
        <button
          type="button"
          onClick={() => {
            if (deepFired.current) {
              deepFired.current = false;
              return;
            }
            onRefresh();
          }}
          onPointerDown={startPress}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          disabled={refreshing}
          aria-label="Refresh now. Long-press for deep refresh (X)."
          title="Tap: refresh · Long-press: deep refresh (1 X call)"
          data-testid="refresh-btn"
          className="flex h-11 w-11 items-center justify-center border border-[var(--pw-ink)] bg-transparent text-base text-[var(--pw-ink)] transition-colors duration-[120ms] hover:bg-[var(--pw-rule)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)] disabled:opacity-50"
        >
          {refreshing ? "…" : "↻"}
        </button>
      </div>
    </footer>
  );
}
