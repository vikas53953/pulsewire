"use client";

type StatusBarProps = {
  generatedAt: string | null;
  lastVisit?: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  xPulseUsage?: { month: string; used: number; cap: number };
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
  xPulseUsage,
}: StatusBarProps) {
  const left = leftLabel(lastVisit);
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 border-t-2 border-[var(--ink)] pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
      <span data-testid="status-updated">
        {updatedLabel(generatedAt)}
        {left ? ` · ${left}` : ""}
        {" · auto-refresh 10 min"}
        {xPulseUsage ? (
          <span data-testid="xpulse-usage">
            {" "}
            · X Pulse {xPulseUsage.used}/{xPulseUsage.cap} this month
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh now"
        data-testid="refresh-btn"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--card)] text-base shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-[1px_1px_0_var(--shadow)] disabled:opacity-50"
      >
        {refreshing ? "…" : "↻"}
      </button>
    </footer>
  );
}
