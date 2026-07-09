"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BentoGrid, StaleBanner } from "@/components/BentoGrid";
import { Header } from "@/components/Header";
import { ScoreChips } from "@/components/ScoreChips";
import { StatusBar } from "@/components/StatusBar";
import { VerdictHero } from "@/components/VerdictHero";
import {
  isNewerThanLastVisit,
  readLastVisit,
  writeLastVisit,
} from "@/lib/last-visit";
import type {
  ContentSectionId,
  HighlightItem,
  HighlightsResponse,
  Lens,
  SectionId,
  TimeWindow,
} from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

const AUTO_REFRESH_MS = 10 * 60_000;
const THEME_KEY = "pulsewire-theme";
const SESSION_KEY = "pulsewire-session-start";

type ClientCache = Map<string, HighlightsResponse>;

function clientKey(
  section: SectionId,
  timeWindow: TimeWindow,
  lens: Lens,
  since: string | null
): string {
  return `${section}|${timeWindow}|${lens}|${since ?? ""}`;
}

function markNewItems(
  items: HighlightItem[],
  lastVisit: number | null
): HighlightItem[] {
  return items.map((item) => ({
    ...item,
    isNew: isNewerThanLastVisit(item.publishedAt, lastVisit),
  }));
}

async function fetchHighlights(
  section: SectionId,
  timeWindow: TimeWindow,
  lens: Lens,
  since: string | null,
  refresh = false
): Promise<HighlightsResponse> {
  const params = new URLSearchParams({
    section,
    window: timeWindow,
    lens,
  });
  if (lens === "since" && since) params.set("since", since);
  if (refresh) params.set("refresh", "1");
  const res = await fetch(`/api/highlights?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return (await res.json()) as HighlightsResponse;
}

function nextWiderWindow(current: TimeWindow): TimeWindow {
  const idx = TIME_WINDOWS.indexOf(current);
  if (current === "1h") return "4h";
  if (idx < 0 || idx >= TIME_WINDOWS.length - 1) return "4h";
  return TIME_WINDOWS[idx + 1];
}

function readInitialNight(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "night") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function recordSessionStart(): void {
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    }
  } catch {
    // ignore
  }
}

export function PulseWireApp() {
  const [section, setSection] = useState<SectionId>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("4h");
  const [lens, setLens] = useState<Lens>("window");
  const [data, setData] = useState<HighlightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [night, setNight] = useState(readInitialNight);
  const [error, setError] = useState<string | null>(null);
  const [hasLastVisit, setHasLastVisit] = useState(false);
  const requestId = useRef(0);
  const clientCache = useRef<ClientCache>(new Map());
  const lastVisitRef = useRef<number | null>(null);

  useEffect(() => {
    recordSessionStart();
    const lv = readLastVisit();
    lastVisitRef.current = lv;
    setHasLastVisit(lv != null);
    // 2nd+ visit → default to since lens
    if (lv != null) {
      setLens("since");
    }
    const onHide = () => {
      writeLastVisit(Date.now());
      try {
        const start = Number(sessionStorage.getItem(SESSION_KEY) || "0");
        if (start > 0) {
          const secs = Math.round((Date.now() - start) / 1000);
          console.info(`[pulsewire] session-end secs=${secs}`);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("night", night);
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "light");
    } catch {
      // ignore
    }
  }, [night]);

  const sinceIso =
    lens === "since" && lastVisitRef.current
      ? new Date(lastVisitRef.current).toISOString()
      : null;

  const showFor = useCallback(
    (nextSection: SectionId, nextWindow: TimeWindow, nextLens: Lens) => {
      const since =
        nextLens === "since" && lastVisitRef.current
          ? new Date(lastVisitRef.current).toISOString()
          : null;
      const cached = clientCache.current.get(
        clientKey(nextSection, nextWindow, nextLens, since)
      );
      if (cached) {
        setData({
          ...cached,
          items: markNewItems(cached.items, lastVisitRef.current),
        });
        setLoading(false);
        return true;
      }
      setData(null);
      setLoading(true);
      return false;
    },
    []
  );

  const load = useCallback(
    async (
      targetSection: SectionId,
      targetWindow: TimeWindow,
      targetLens: Lens,
      opts?: { refresh?: boolean; soft?: boolean }
    ) => {
      const id = ++requestId.current;
      const refresh = Boolean(opts?.refresh);
      const soft = Boolean(opts?.soft);
      const since =
        targetLens === "since" && lastVisitRef.current
          ? new Date(lastVisitRef.current).toISOString()
          : null;

      if (refresh) {
        clientCache.current.clear();
      }

      const key = clientKey(targetSection, targetWindow, targetLens, since);
      if (!soft && !clientCache.current.has(key)) {
        setLoading(true);
        setData(null);
      } else if (soft) {
        setRefreshing(true);
      }
      setError(null);

      try {
        const payload = await fetchHighlights(
          targetSection,
          targetWindow,
          targetLens,
          since,
          refresh
        );
        if (id !== requestId.current) return;
        const withNew = {
          ...payload,
          items: markNewItems(payload.items, lastVisitRef.current),
        };
        clientCache.current.set(key, withNew);
        setData(withNew);
      } catch (err) {
        if (id !== requestId.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const hit = showFor(section, timeWindow, lens);
    void load(section, timeWindow, lens, { soft: hit });
  }, [section, timeWindow, lens, load, showFor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(section, timeWindow, lens, { soft: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, section, timeWindow, lens]);

  const onChipSelect = (next: ContentSectionId | "all") => {
    if (next === section) return;
    setSection(next);
  };

  const showStale =
    Boolean(data?.stale) || Boolean(data?.sourcesUnreachable);

  const visibleItems =
    data && data.section === section ? data.items : [];
  const showSkeleton = loading || !data || data.section !== section;

  const quietTop =
    data?.verdict?.level === "green" && visibleItems[0]
      ? `Top of the quiet: ${visibleItems[0].text}`
      : null;

  // Quiet hero: only verdict + one line, no bento fill
  const quietHero =
    data?.verdict?.level === "green" &&
    !showSkeleton &&
    data.scores.every((s) => s.level === "green");

  return (
    <div className="mx-auto min-h-screen w-full max-w-zine px-3 py-4 sm:px-5 sm:py-6">
      <div className="flex flex-col gap-4">
        <Header
          lens={lens}
          window={timeWindow}
          onLensChange={setLens}
          onWindowChange={setTimeWindow}
          hasLastVisit={hasLastVisit}
          night={night}
          onToggleNight={() => setNight((v) => !v)}
          rawMode={Boolean(data?.rawMode && data.section === section)}
        />

        <VerdictHero
          verdict={showSkeleton ? null : data?.verdict ?? null}
          quietTop={quietHero ? quietTop : null}
        />

        <ScoreChips
          scores={data?.scores ?? []}
          active={section === "xpulse" ? "all" : (section as ContentSectionId | "all")}
          onSelect={onChipSelect}
        />

        <StaleBanner show={showStale && !showSkeleton} />

        {error ? (
          <div className="pw-tile bg-[var(--card)] p-4 text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Could not load highlights — {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() =>
                void load(section, timeWindow, lens, { refresh: true })
              }
            >
              Retry
            </button>
          </div>
        ) : null}

        {!quietHero ? (
          <BentoGrid
            key={`${section}-${timeWindow}-${lens}`}
            items={visibleItems}
            loading={showSkeleton}
            section={section}
            window={timeWindow}
            onTryWiderWindow={() =>
              setTimeWindow(nextWiderWindow(timeWindow))
            }
          />
        ) : null}

        <StatusBar
          generatedAt={
            data && data.section === section ? data.generatedAt : null
          }
          lastVisit={lastVisitRef.current}
          refreshing={refreshing}
          onRefresh={() =>
            void load(section, timeWindow, lens, {
              refresh: true,
              soft: true,
            })
          }
          xPulseUsage={
            section === "xpulse" && data?.section === "xpulse"
              ? data.xPulseUsage
              : undefined
          }
        />
      </div>
    </div>
  );
}
