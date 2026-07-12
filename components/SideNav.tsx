"use client";

import { useEffect, useState } from "react";

type SideNavProps = {
  active: "today" | "trend";
  onToday: () => void;
  onTrend: () => void;
};

function istClock(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(now)} IST`;
}

/**
 * MORNING FEED desktop nav rail (spec §4.1). Today/Trend are live views;
 * Desks scrolls to the ring row; History is visibly not-yet (never a dead
 * link pretending to work).
 */
export function SideNav({ active, onToday, onTrend }: SideNavProps) {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const tick = () => setClock(istClock(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const item = (selected: boolean) =>
    `pw-display block w-full min-h-11 rounded-[var(--pw-r-chip)] px-3 py-2 text-left text-[17px] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-ink)] ${
      selected
        ? "font-bold text-[var(--pw-ink)]"
        : "font-medium text-[var(--pw-dim)] hover:text-[var(--pw-ink)]"
    }`;

  return (
    <nav
      data-testid="side-nav"
      aria-label="PulseWire navigation"
      className="sticky top-0 hidden h-screen flex-col py-5 pr-4 xl:flex"
    >
      <p className="pw-display m-0 mb-8 text-[22px] font-extrabold tracking-[0.04em] text-[var(--pw-ink)]">
        PULSEWIRE
      </p>
      <button type="button" className={item(active === "today")} onClick={onToday}>
        {active === "today" ? "● " : ""}Today
      </button>
      <button
        type="button"
        className={item(false)}
        onClick={() => {
          document
            .querySelector('[data-testid="score-chips"]')
            ?.scrollIntoView({ block: "center" });
        }}
      >
        Desks
      </button>
      <button type="button" className={item(active === "trend")} onClick={onTrend}>
        {active === "trend" ? "● " : ""}Trend
      </button>
      <span
        className={`${item(false)} cursor-default opacity-50 hover:text-[var(--pw-dim)]`}
        aria-disabled
        title="History — coming with the baseline archive"
      >
        History
        <span className="pw-mono ml-2 text-[10px] uppercase tracking-[0.08em]">
          soon
        </span>
      </span>
      <span
        className="pw-mono mt-auto text-[12px] text-[var(--pw-dim)]"
        suppressHydrationWarning
      >
        {clock} · auto 10 min
      </span>
    </nav>
  );
}
