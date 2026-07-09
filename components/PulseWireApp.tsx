"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BentoGrid, StaleBanner } from "@/components/BentoGrid";
import { Header } from "@/components/Header";
import { SectionTabs } from "@/components/SectionTabs";
import { StatusBar } from "@/components/StatusBar";
import type {
  HighlightsResponse,
  SectionId,
  TimeWindow,
} from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

const AUTO_REFRESH_MS = 10 * 60_000;
const THEME_KEY = "pulsewire-theme";

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

  useEffect(() => {
    document.documentElement.classList.toggle("night", night);
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "light");
    } catch {
      // ignore
    }
  }, [night]);

  const load = useCallback(
    async (opts?: { refresh?: boolean; soft?: boolean }) => {
      const id = ++requestId.current;
      const refresh = Boolean(opts?.refresh);
      const soft = Boolean(opts?.soft);

      if (!soft) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const payload = await fetchHighlights(section, timeWindow, refresh);
        if (id !== requestId.current) return;
        setData(payload);
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
    [section, timeWindow]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load({ soft: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const showStale =
    Boolean(data?.stale) || Boolean(data?.sourcesUnreachable);

  return (
    <div className="mx-auto min-h-screen w-full max-w-zine px-3 py-4 sm:px-5 sm:py-6">
      <div className="flex flex-col gap-4">
        <Header
          window={timeWindow}
          onWindowChange={setTimeWindow}
          night={night}
          onToggleNight={() => setNight((v) => !v)}
          rawMode={Boolean(data?.rawMode)}
        />

        <SectionTabs value={section} onChange={setSection} />

        <StaleBanner show={showStale && !loading} />

        {error ? (
          <div className="pw-tile bg-[var(--card)] p-4 text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Could not load highlights — {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => void load({ refresh: true })}
            >
              Retry
            </button>
          </div>
        ) : null}

        <BentoGrid
          items={data?.items ?? []}
          loading={loading && !data}
          section={section}
          window={timeWindow}
          onTryWiderWindow={() => setTimeWindow(nextWiderWindow(timeWindow))}
        />

        <StatusBar
          generatedAt={data?.generatedAt ?? null}
          refreshing={refreshing}
          onRefresh={() => void load({ refresh: true, soft: true })}
        />
      </div>
    </div>
  );
}
