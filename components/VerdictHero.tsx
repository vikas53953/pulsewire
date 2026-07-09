"use client";

import type { VerdictPayload } from "@/lib/types";

type VerdictHeroProps = {
  verdict: VerdictPayload | null;
  quietTop?: string | null;
};

export function VerdictHero({ verdict, quietTop }: VerdictHeroProps) {
  if (!verdict) {
    return (
      <div
        data-testid="verdict-skeleton"
        className="pw-tile pw-skeleton min-h-[88px] w-full"
      />
    );
  }

  return (
    <section
      data-testid="verdict-hero"
      data-level={verdict.level}
      data-llm={verdict.llmPolished ? "1" : "0"}
      className="pw-tile relative w-full bg-[var(--card)] px-4 py-4 sm:px-5 sm:py-5"
      aria-live="polite"
    >
      <p className="m-0 text-[20px] font-black leading-snug tracking-tight text-[var(--ink)] sm:text-[22px]">
        ❝ {verdict.text} ❞
      </p>
      {verdict.level === "green" && quietTop ? (
        <p
          data-testid="quiet-top"
          className="mt-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--ink)] opacity-70"
        >
          {quietTop}
        </p>
      ) : null}
    </section>
  );
}
