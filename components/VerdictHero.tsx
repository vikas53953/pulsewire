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

  const isBlind = Boolean(verdict.blind);
  const isQuiet = verdict.level === "green" && !isBlind;

  return (
    <section
      data-testid="verdict-hero"
      data-level={verdict.level}
      data-llm={verdict.llmPolished ? "1" : "0"}
      data-quiet={isQuiet ? "1" : "0"}
      data-blind={isBlind ? "1" : "0"}
      className={`pw-tile relative w-full bg-[var(--card)] px-4 py-4 sm:px-5 sm:py-5 ${
        isQuiet ? "border-[var(--ink)]/10" : ""
      }`}
      aria-live="polite"
    >
      {isBlind ? (
        <p
          data-testid="blind-banner"
          className="m-0 mb-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mega)]"
        >
          Status unknown
        </p>
      ) : isQuiet ? (
        <p
          data-testid="quiet-win"
          className="m-0 mb-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] opacity-55"
        >
          Quiet is a win
        </p>
      ) : null}
      <p
        className={`m-0 font-black leading-snug tracking-tight text-[var(--ink)] ${
          isQuiet
            ? "text-[22px] sm:text-[26px]"
            : "text-[20px] sm:text-[22px]"
        }`}
      >
        {verdict.text}
      </p>
      {verdict.why ? (
        <p
          data-testid="verdict-why"
          className="mt-3 text-[13px] font-bold leading-snug text-[var(--ink)] opacity-70"
        >
          {verdict.why}
        </p>
      ) : null}
      {isQuiet && quietTop ? (
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
