"use client";

type StatusBarProps = {
  generatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
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

export function StatusBar({
  generatedAt,
  refreshing,
  onRefresh,
}: StatusBarProps) {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 border-t-2 border-[var(--ink)] pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
      <span>
        {updatedLabel(generatedAt)} · auto-refresh 10 min
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
