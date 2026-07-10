"use client";

type Props = {
  generatedAt?: string | null;
  loading?: boolean;
};

function formatFreshness(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Updated just now";
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return "Updated 1 hour ago";
  return `Updated ${hours} hours ago`;
}

/** Persistent last-updated line under desk chips (Soft-ship freshness). */
export function FreshnessLine({ generatedAt, loading }: Props) {
  if (loading && !generatedAt) {
    return (
      <p
        className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.06em] opacity-55"
        data-testid="freshness-line"
      >
        Updating…
      </p>
    );
  }
  if (!generatedAt) return null;
  return (
    <p
      className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.06em] opacity-55"
      data-testid="freshness-line"
    >
      {formatFreshness(generatedAt)}
    </p>
  );
}
