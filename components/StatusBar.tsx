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

function updatedLabel(generatedAt: string | null): string {
  if (!generatedAt) return "updated —";
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(generatedAt).getTime()) / 60_000)
  );
  if (mins < 1) return "updated just now";
  return `updated ${mins}m ago`;
}

function leftLabel(lastVisit: number | null | undefined): string | null {
  if (lastVisit == null) return null;
  const mins = Math.max(0, Math.round((Date.now() - lastVisit) / 60_000));
  if (mins < 1) return "you left just now";
  if (mins < 60) return `you left ${mins}m ago`;
  return `you left ${Math.round(mins / 60)}h ago`;
}

export function StatusBar({
  generatedAt,
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
    <footer className="flex flex-col items-center gap-2 border-t-2 border-[var(--ink)] pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
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
          {updatedLabel(generatedAt)}
          {left ? ` · ${left}` : ""}
          {" · auto-refresh 10 min"}
          {dailyUsed != null && dailyCap != null ? (
            <span data-testid="x-daily-usage">
              {" "}
              · X: {dailyUsed}/{dailyCap} today
            </span>
          ) : null}
          {xPulseUsage && dailyUsed == null ? (
            <span data-testid="xpulse-usage">
              {" "}
              · X Pulse {xPulseUsage.used}/{xPulseUsage.cap} this month
            </span>
          ) : null}
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
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--card)] text-base shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-[1px_1px_0_var(--shadow)] disabled:opacity-50"
        >
          {refreshing ? "…" : "↻"}
        </button>
      </div>
    </footer>
  );
}
