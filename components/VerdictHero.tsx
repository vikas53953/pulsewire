"use client";

import type { VerdictPayload } from "@/lib/types";

type VerdictHeroProps = {
  verdict: VerdictPayload | null;
  quietTop?: string | null;
};

/**
 * Signal design: the verdict is the one dramatic element on the page —
 * large serif type set directly on the ground, no card chrome.
 * Blind state keeps a hot rule so "status unknown" can't read as calm.
 */
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
      className={`relative w-full py-1 ${
        isBlind ? "border-l-[3px] border-[var(--hot)] pl-4" : ""
      }`}
      aria-live="polite"
    >
      {isBlind ? (
        <p
          data-testid="blind-banner"
          className="pw-mono m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--hot)]"
        >
          Status unknown
        </p>
      ) : isQuiet ? (
        <p
          data-testid="quiet-win"
          className="pw-mono m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]"
        >
          Quiet is a win
        </p>
      ) : null}
      <p
        className={`pw-verdict-type m-0 max-w-[42ch] font-bold text-[var(--ink)] [text-wrap:balance] ${
          isQuiet
            ? "text-[26px] leading-[1.3] sm:text-[30px]"
            : "text-[24px] leading-[1.32] sm:text-[28px]"
        }`}
      >
        {verdict.text}
      </p>
      {verdict.why ? (
        <p
          data-testid="verdict-why"
          className="mt-2.5 max-w-[68ch] text-[13px] leading-snug text-[var(--muted)]"
        >
          {verdict.why}
        </p>
      ) : null}
      {isQuiet && quietTop ? (
        <p
          data-testid="quiet-top"
          className="mt-2.5 text-[12px] text-[var(--muted)]"
        >
          {quietTop}
        </p>
      ) : null}
    </section>
  );
}
