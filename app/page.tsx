import { getHighlights } from "@/lib/highlights";

export const dynamic = "force-dynamic";

function ageLabel(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(ageMs / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

function isOlderThanWindow(iso: string, windowHours: number): boolean {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs > windowHours * 3_600_000 + 60_000;
}

export default async function HomePage() {
  const data = await getHighlights({
    section: "markets",
    window: "4h",
  });

  const older = data.items.filter((item) =>
    isOlderThanWindow(item.publishedAt, 4)
  );
  const missingTs = data.items.filter((item) => !item.publishedAt);
  const gatePass =
    data.items.length > 0 && older.length === 0 && missingTs.length === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="border-b border-[var(--line)] pb-4">
        <h1
          className="text-3xl font-extrabold tracking-tight text-[var(--accent)]"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          ⚡ PulseWire
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          M1 feed engine gate check — Markets · last 4h
        </p>
      </header>

      <section
        className={`rounded border px-4 py-3 text-sm ${
          gatePass
            ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
            : "border-amber-700/60 bg-amber-950/40 text-amber-200"
        }`}
      >
        <p className="font-semibold">
          Gate: {gatePass ? "PASS" : "FAIL"}
        </p>
        <p className="mt-1 opacity-90">
          {data.items.length} items · older-than-4h: {older.length} · missing
          timestamps: {missingTs.length} · stale: {String(data.stale)} ·
          rawMode: {String(data.rawMode)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Markets highlights
        </h2>
        {data.items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Quiet hour — nothing hot in the last 4h.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {data.items.map((item, index) => (
              <li key={`${item.publishedAt}-${index}`} className="py-3">
                <a
                  href={item.sources[0]?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm leading-snug text-[var(--fg)] hover:text-[var(--accent)]"
                >
                  {item.text}
                </a>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.sources.map((s) => s.name).join(" · ")} ·{" "}
                  {ageLabel(item.publishedAt)} ·{" "}
                  <code className="text-[10px]">{item.publishedAt}</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 text-xs text-[var(--muted)]">
        <p>
          Raw JSON (may look blank in some browsers — use View Source or the
          list above):
        </p>
        <a
          className="inline-block text-[var(--accent)] underline-offset-2 hover:underline"
          href="/api/highlights?section=markets&window=4h"
        >
          /api/highlights?section=markets&amp;window=4h
        </a>
      </section>
    </main>
  );
}
