export default function HomePage() {
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
          M1 feed engine is live. UI arrives in M3.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-[var(--fg)]">
        <p>
          Verify the API before continuing:
        </p>
        <a
          className="inline-block rounded border border-[var(--line)] bg-[#121a24] px-3 py-2 text-[var(--accent)] underline-offset-2 hover:underline"
          href="/api/highlights?section=markets&window=4h"
        >
          /api/highlights?section=markets&amp;window=4h
        </a>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
          <li>Items should include real ISO timestamps in <code>publishedAt</code>.</li>
          <li>Nothing should be older than the selected window (4h).</li>
          <li>Response includes <code>stale</code> and <code>rawMode</code>.</li>
        </ul>
      </section>
    </main>
  );
}
