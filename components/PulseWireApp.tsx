"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BentoGrid, StaleBanner } from "@/components/BentoGrid";
import { Header } from "@/components/Header";
import { SectionTabs } from "@/components/SectionTabs";
import { StatusBar } from "@/components/StatusBar";
import {
  isNewerThanLastVisit,
  readLastVisit,
  writeLastVisit,
} from "@/lib/last-visit";
import type {
  HighlightItem,
  HighlightsResponse,
  SectionId,
  TimeWindow,
} from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

const AUTO_REFRESH_MS = 10 * 60_000;
const THEME_KEY = "pulsewire-theme";

type ClientCache = Map<string, HighlightsResponse>;

function clientKey(section: SectionId, timeWindow: TimeWindow): string {
  return `${section}|${timeWindow}`;
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
  refresh = false
): Promise<HighlightsResponse> {
  const params = new URLSearchParams({ section, window: timeWindow });
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

export function PulseWireApp() {
  const [section, setSection] = useState<SectionId>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("4h");
  const [data, setData] = useState<HighlightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [night, setNight] = useState(readInitialNight);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const clientCache = useRef<ClientCache>(new Map());
  const lastVisitRef = useRef<number | null>(null);

  useEffect(() => {
    lastVisitRef.current = readLastVisit();
    const onHide = () => writeLastVisit(Date.now());
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

  const showFor = useCallback(
    (nextSection: SectionId, nextWindow: TimeWindow) => {
      const cached = clientCache.current.get(clientKey(nextSection, nextWindow));
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
      opts?: { refresh?: boolean; soft?: boolean }
    ) => {
      const id = ++requestId.current;
      const refresh = Boolean(opts?.refresh);
      const soft = Boolean(opts?.soft);

      if (refresh) {
        for (const key of Array.from(clientCache.current.keys())) {
          if (key.startsWith(`${targetSection}|`)) {
            clientCache.current.delete(key);
          }
        }
      }

      if (
        !soft &&
        !clientCache.current.has(clientKey(targetSection, targetWindow))
      ) {
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
          refresh
        );
        if (id !== requestId.current) return;
        const withNew = {
          ...payload,
          items: markNewItems(payload.items, lastVisitRef.current),
        };
        clientCache.current.set(
          clientKey(targetSection, targetWindow),
          withNew
        );
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
    const hit = showFor(section, timeWindow);
    void load(section, timeWindow, { soft: hit });
  }, [section, timeWindow, load, showFor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(section, timeWindow, { soft: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, section, timeWindow]);

  const onSectionChange = (next: SectionId) => {
    if (next === section) return;
    setSection(next);
  };

  const onWindowChange = (next: TimeWindow) => {
    if (next === timeWindow) return;
    setTimeWindow(next);
  };

  const showStale =
    Boolean(data?.stale) || Boolean(data?.sourcesUnreachable);

  const visibleItems =
    data && data.section === section ? data.items : [];
  const showSkeleton = loading || !data || data.section !== section;

  return (
    <div className="mx-auto min-h-screen w-full max-w-zine px-3 py-4 sm:px-5 sm:py-6">
      <div className="flex flex-col gap-4">
        <Header
          window={timeWindow}
          onWindowChange={onWindowChange}
          night={night}
          onToggleNight={() => setNight((v) => !v)}
          rawMode={Boolean(data?.rawMode && data.section === section)}
        />

        <SectionTabs value={section} onChange={onSectionChange} />

        <StaleBanner show={showStale && !showSkeleton} />

        {error ? (
          <div className="pw-tile bg-[var(--card)] p-4 text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Could not load highlights — {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => void load(section, timeWindow, { refresh: true })}
            >
              Retry
            </button>
          </div>
        ) : null}

        <BentoGrid
          key={`${section}-${timeWindow}`}
          items={visibleItems}
          loading={showSkeleton}
          section={section}
          window={timeWindow}
          onTryWiderWindow={() => onWindowChange(nextWiderWindow(timeWindow))}
        />

        <StatusBar
          generatedAt={
            data && data.section === section ? data.generatedAt : null
          }
          refreshing={refreshing}
          onRefresh={() =>
            void load(section, timeWindow, { refresh: true, soft: true })
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
