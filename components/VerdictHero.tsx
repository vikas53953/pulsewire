"use client";

import type { VerdictPayload } from "@/lib/types";
import { sectionLabel } from "@/lib/types";

type VerdictHeroProps = {
  verdict: VerdictPayload | null;
  quietTop?: string | null;
};

function istNow(): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(new Date());
  } catch {
    return "";
  }
}

/**
 * MORNING FEED pinned verdict post (spec §4.3): the product speaks first,
 * as a post from "PulseWire". Plate inverts vs the page so it is always
 * the brightest element. Unknown out-shouts hot: inverted achromatic plate
 * with a 4px dashed border and an alert tag.
 */
export function VerdictHero({ verdict, quietTop }: VerdictHeroProps) {
  if (!verdict) {
    return (
      <div
        data-testid="verdict-skeleton"
        className="pw-skeleton min-h-[104px] w-full"
      />
    );
  }

  const isBlind = Boolean(verdict.blind);
  const isQuiet = verdict.level === "green" && !isBlind;
  const isHot = verdict.level === "red" && !isBlind;
  const time = istNow();

  let plate = "";
  let plateStyle: React.CSSProperties = {};
  let tag = `VERDICT · PINNED${time ? ` · ${time}` : ""}`;
  let tagColor = "var(--pw-verdict-tag)";
  let inkColor = "var(--pw-verdict-ink)";
  let dimColor = "var(--pw-verdict-dim)";

  if (isBlind) {
    plate = "border-4 border-dashed";
    plateStyle = {
      background: "var(--pw-unk-bg)",
      borderColor: "var(--pw-unk-ink)",
    };
    tag = "⚠ STATUS UNKNOWN — NOT QUIET · VERDICT WITHHELD";
    tagColor = "var(--pw-unk-alert)";
    inkColor = "var(--pw-unk-ink)";
    dimColor = "var(--pw-unk-ink)";
  } else if (isHot) {
    plateStyle = { background: "var(--pw-hot)" };
    tag = `VERDICT · ${verdict.drivingSection ? sectionLabel(verdict.drivingSection).toUpperCase() + " " : ""}HOT${time ? ` · ${time}` : ""}`;
    tagColor = "var(--pw-bg)";
    inkColor = "var(--pw-bg)";
    dimColor = "var(--pw-bg)";
  } else if (isQuiet) {
    plate = "border-2";
    plateStyle = {
      background: "var(--pw-win-bg)",
      borderColor: "var(--pw-success)",
    };
    tag = "VERDICT · ALL QUIET";
    tagColor = "var(--pw-success)";
    inkColor = "var(--pw-win-ink)";
    dimColor = "var(--pw-win-dim)";
  } else {
    plateStyle = { background: "var(--pw-verdict-bg)" };
  }

  return (
    <section
      data-testid="verdict-hero"
      data-level={verdict.level}
      data-llm={verdict.llmPolished ? "1" : "0"}
      data-quiet={isQuiet ? "1" : "0"}
      data-blind={isBlind ? "1" : "0"}
      aria-live="polite"
      className={`w-full rounded-[var(--pw-r-card)] px-4 py-4 sm:px-[30px] sm:py-6 ${plate}`}
      style={plateStyle}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className="pw-display text-[15px] font-bold"
          style={{ color: inkColor }}
        >
          PulseWire
        </span>
        <span
          data-testid={isBlind ? "blind-banner" : undefined}
          className="pw-mono text-[12px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: tagColor }}
        >
          {tag}
        </span>
      </div>
      <p
        className="pw-verdict-type m-0 mt-3 max-w-[36ch] text-[17px] font-semibold leading-[1.32] sm:text-[26px]"
        style={{ color: inkColor }}
      >
        {isQuiet ? <span data-testid="quiet-win">{verdict.text}</span> : verdict.text}
      </p>
      {verdict.why ? (
        <p
          data-testid="verdict-why"
          className="pw-mono m-0 mt-3 max-w-[68ch] text-[13px] leading-[1.55] sm:text-[15px]"
          style={{ color: dimColor, opacity: isBlind || isHot ? 0.9 : 1 }}
        >
          {verdict.why.replace(/^Watch:\s*/i, "watch — ")}
        </p>
      ) : null}
      {isQuiet && quietTop ? (
        <p
          data-testid="quiet-top"
          className="pw-mono m-0 mt-3 text-[13px] leading-[1.55]"
          style={{ color: dimColor }}
        >
          top of the quiet — {quietTop.replace(/^Top of the quiet:\s*/i, "")}
        </p>
      ) : null}
    </section>
  );
}
