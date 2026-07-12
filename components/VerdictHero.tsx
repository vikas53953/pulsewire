"use client";

import type { VerdictPayload } from "@/lib/types";

type VerdictHeroProps = {
  verdict: VerdictPayload | null;
  quietTop?: string | null;
};

function stampFor(level: VerdictPayload["level"]): {
  word: string;
  cls: string;
} {
  if (level === "red") {
    // The only filled color plate in the system (spec §4.3).
    return {
      word: "HOT",
      cls: "bg-[var(--pw-hot)] text-[var(--pw-paper)] border border-[var(--pw-hot)]",
    };
  }
  if (level === "yellow") {
    return {
      word: "MOSTLY QUIET",
      cls: "border-[1.5px] border-[var(--pw-warm)] text-[var(--pw-warm)]",
    };
  }
  return {
    word: "ALL QUIET",
    cls: "border-[1.5px] border-[var(--pw-calm)] text-[var(--pw-calm)]",
  };
}

/**
 * WIRE DESK verdict zone (spec §4.3): status stamp → condensed sentence →
 * mono watch-line; quiet win = bordered calm plate; unknown = inverted
 * hazard plate that out-shouts HOT.
 */
export function VerdictHero({ verdict, quietTop }: VerdictHeroProps) {
  if (!verdict) {
    return (
      <div
        data-testid="verdict-skeleton"
        className="pw-skeleton min-h-[88px] w-full"
      />
    );
  }

  const isBlind = Boolean(verdict.blind);
  const isQuiet = verdict.level === "green" && !isBlind;

  if (isBlind) {
    return (
      <section
        data-testid="verdict-hero"
        data-level={verdict.level}
        data-llm={verdict.llmPolished ? "1" : "0"}
        data-quiet="0"
        data-blind="1"
        className="pw-rule-close w-full py-4"
        aria-live="polite"
      >
        <div style={{ background: "var(--pw-hazard)", padding: 7 }}>
          <div className="bg-[var(--pw-unknown-bg)] px-4 py-5 text-[var(--pw-unknown-fg)]">
            <p
              data-testid="blind-banner"
              className="pw-display m-0 text-[32px] font-bold leading-[1.05] tracking-[0.04em]"
            >
              STATUS UNKNOWN
            </p>
            <p className="pw-mono m-0 mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
              Not quiet — verdict withheld
            </p>
            <p className="pw-mono m-0 mt-3 text-[12px] leading-[1.55]">
              {verdict.text}
            </p>
            {verdict.why ? (
              <p
                data-testid="verdict-why"
                className="pw-mono m-0 mt-2 text-[12px] leading-[1.55] opacity-90"
              >
                {verdict.why}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (isQuiet) {
    return (
      <section
        data-testid="verdict-hero"
        data-level={verdict.level}
        data-llm={verdict.llmPolished ? "1" : "0"}
        data-quiet="1"
        data-blind="0"
        className="pw-rule-close w-full py-4"
        aria-live="polite"
      >
        <div className="border-2 border-[var(--pw-calm)] px-[18px] py-[22px]">
          <p
            data-testid="quiet-win"
            className="pw-display m-0 text-[40px] font-bold leading-[1.05] tracking-[0.04em] text-[var(--pw-calm)]"
          >
            ALL QUIET
          </p>
          <p className="pw-verdict-type m-0 mt-2 text-[21px] font-bold leading-[1.2] text-[var(--pw-ink)]">
            {verdict.text}
          </p>
          {quietTop ? (
            <p
              data-testid="quiet-top"
              className="pw-mono m-0 mt-3 text-[12px] uppercase tracking-[0.06em] text-[var(--pw-ink-dim)]"
            >
              {quietTop}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const stamp = stampFor(verdict.level);
  return (
    <section
      data-testid="verdict-hero"
      data-level={verdict.level}
      data-llm={verdict.llmPolished ? "1" : "0"}
      data-quiet="0"
      data-blind="0"
      className="pw-rule-close w-full pb-5 pt-[18px]"
      aria-live="polite"
    >
      <span
        className={`pw-mono inline-block px-[9px] py-[5px] text-[10px] font-semibold uppercase tracking-[0.16em] ${stamp.cls}`}
      >
        {stamp.word}
      </span>
      <p className="pw-verdict-type m-0 mt-3 max-w-[30ch] text-[24px] font-bold leading-[1.16] text-[var(--pw-ink)] sm:text-[27px]">
        {verdict.text}
      </p>
      {verdict.why ? (
        <p
          data-testid="verdict-why"
          className="pw-mono m-0 mt-3 max-w-[68ch] text-[12px] leading-[1.55] text-[var(--pw-ink-dim)]"
        >
          {verdict.why.startsWith("Watch") ? (
            <>
              <span className="uppercase">WATCH — </span>
              {verdict.why.replace(/^Watch:\s*/i, "")}
            </>
          ) : (
            verdict.why
          )}
        </p>
      ) : null}
    </section>
  );
}
