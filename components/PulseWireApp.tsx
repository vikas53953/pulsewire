"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BentoGrid, StaleBanner } from "@/components/BentoGrid";
import { BriefOverlay } from "@/components/BriefOverlay";
import { Header } from "@/components/Header";
import { RadarStrip } from "@/components/RadarStrip";
import { ScoreChips } from "@/components/ScoreChips";
import { StatusBar } from "@/components/StatusBar";
import { VerdictHero } from "@/components/VerdictHero";
import { VibePanel } from "@/components/VibePanel";
import type { BriefPayload } from "@/lib/brief";
import type { RadarStatus } from "@/lib/radar";
import type { VibeResponse } from "@/lib/vibe";
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
  VerdictPayload,
} from "@/lib/types";
import { TIME_WINDOWS } from "@/lib/types";

const AUTO_REFRESH_MS = 10 * 60_000;
const THEME_KEY = "pulsewire-theme";
const SESSION_KEY = "pulsewire-session-start";

type ClientCache = Map<string, HighlightsResponse>;
type ChipId = ContentSectionId | "all" | "vibe" | "radar";

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
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [vibe, setVibe] = useState<VibeResponse | null>(null);
  const [vibeLoading, setVibeLoading] = useState(false);
  const [radar, setRadar] = useState<RadarStatus | null>(null);
  const requestId = useRef(0);
  const clientCache = useRef<ClientCache>(new Map());
  const lastVisitRef = useRef<number | null>(null);

  useEffect(() => {
    recordSessionStart();
    const lv = readLastVisit();
    lastVisitRef.current = lv;
    setHasLastVisit(lv != null);
    if (lv != null) setLens("since");
    const onHide = () => writeLastVisit(Date.now());
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "light");
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle("night", night);
  }, [night]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // quiet — installability is best-effort in v3
      });
    }
  }, []);

  const showFor = useCallback(
    (s: SectionId, w: TimeWindow, l: Lens) => {
      const since =
        l === "since" ? String(lastVisitRef.current ?? "") : null;
      return clientCache.current.has(clientKey(s, w, l, since));
    },
    []
  );

  const load = useCallback(
    async (
      targetSection: SectionId,
      nextWindow: TimeWindow,
      nextLens: Lens,
      opts?: { refresh?: boolean; soft?: boolean }
    ) => {
      if (targetSection === "vibe" || targetSection === "radar") return;
      const id = ++requestId.current;
      const since =
        nextLens === "since" && lastVisitRef.current != null
          ? String(lastVisitRef.current)
          : null;
      const key = clientKey(targetSection, nextWindow, nextLens, since);
      if (!opts?.soft) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const json = await fetchHighlights(
          targetSection,
          nextWindow,
          nextLens,
          since,
          Boolean(opts?.refresh)
        );
        if (id !== requestId.current) return;
        json.items = markNewItems(json.items, lastVisitRef.current);
        clientCache.current.set(key, json);
        setData(json);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  const loadVibe = useCallback(async () => {
    setVibeLoading(true);
    try {
      const res = await fetch(`/api/vibe?window=${timeWindow}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`vibe ${res.status}`);
      setVibe((await res.json()) as VibeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVibeLoading(false);
    }
  }, [timeWindow]);

  const loadRadar = useCallback(async () => {
    try {
      const res = await fetch("/api/radar", { cache: "no-store" });
      if (!res.ok) return;
      setRadar((await res.json()) as RadarStatus);
    } catch {
      // quiet
    }
  }, []);

  useEffect(() => {
    void loadRadar();
    const t = window.setInterval(() => void loadRadar(), 60_000);
    return () => window.clearInterval(t);
  }, [loadRadar]);

  useEffect(() => {
    if (section === "vibe") {
      void loadVibe();
      return;
    }
    if (section === "radar") {
      void loadRadar();
      setLoading(false);
      return;
    }
    const hit = showFor(section, timeWindow, lens);
    void load(section, timeWindow, lens, { soft: hit });
  }, [section, timeWindow, lens, load, showFor, loadVibe, loadRadar]);

  useEffect(() => {
    if (section === "vibe" || section === "radar") return;
    const timer = window.setInterval(() => {
      void load(section, timeWindow, lens, { soft: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, section, timeWindow, lens]);

  const onChipSelect = (next: ChipId) => {
    if (next === section) return;
    setSection(next);
  };

  const onOpenBrief = async (item: HighlightItem) => {
    const clusterId =
      item.clusterId ||
      `${item.publishedAt}|${item.text.slice(0, 40)}`;
    setBriefOpen(true);
    setBriefLoading(true);
    setBrief(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clusterId,
          title: item.text,
          sources: item.sources.map((s) => ({ name: s.name, url: s.url })),
        }),
      });
      if (!res.ok) throw new Error(`brief ${res.status}`);
      setBrief((await res.json()) as BriefPayload);
    } catch {
      setBrief({
        clusterId,
        title: item.text,
        lines: null,
        rawMode: true,
        cached: false,
        sources: item.sources.map((s) => ({ name: s.name, url: s.url })),
      });
    } finally {
      setBriefLoading(false);
    }
  };

  const showStale =
    Boolean(data?.stale) || Boolean(data?.sourcesUnreachable);

  const visibleItems =
    data && data.section === section ? data.items : [];
  const showSkeleton =
    section !== "vibe" &&
    section !== "radar" &&
    (loading || !data || data.section !== section);

  const quietTop =
    data?.verdict?.level === "green" && visibleItems[0]
      ? `Top of the quiet: ${visibleItems[0].text}`
      : null;

  const quietHero =
    section !== "vibe" &&
    section !== "radar" &&
    data?.verdict?.level === "green" &&
    !showSkeleton &&
    (data?.scores ?? []).every((s) => s.level === "green");

  const displayVerdict: VerdictPayload | null = (() => {
    if (radar?.verdictHint && radar.verdictHint.level === "red") {
      return radar.verdictHint;
    }
    if (section === "radar") {
      return radar?.verdictHint ?? {
        text: "Radar clear. No tripwires fired.",
        level: "green",
        llmPolished: false,
      };
    }
    if (section === "vibe") {
      return {
        text: "Vibe check — what's loud on Reddit vs X.",
        level: "green",
        llmPolished: false,
      };
    }
    return showSkeleton ? null : data?.verdict ?? null;
  })();

  const chipActive: ChipId =
    section === "xpulse"
      ? "all"
      : section === "vibe" || section === "radar"
        ? section
        : (section as ContentSectionId | "all");

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

        <RadarStrip
          status={radar}
          active={section === "radar"}
          onSelect={() => setSection("radar")}
        />

        <VerdictHero
          verdict={displayVerdict}
          quietTop={quietHero ? quietTop : null}
        />

        <ScoreChips
          scores={data?.scores ?? []}
          active={chipActive}
          onSelect={onChipSelect}
        />

        <StaleBanner show={showStale && !showSkeleton && section !== "vibe"} />

        {error ? (
          <div className="pw-tile bg-[var(--card)] p-4 text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Could not load — {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => {
                if (section === "vibe") void loadVibe();
                else if (section === "radar") void loadRadar();
                else
                  void load(section, timeWindow, lens, { refresh: true });
              }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {section === "vibe" ? (
          <VibePanel data={vibe} loading={vibeLoading} />
        ) : null}

        {section === "radar" ? (
          <div data-testid="radar-panel" className="pw-tile bg-[var(--card)] p-4">
            <p className="m-0 text-[12px] font-bold uppercase tracking-wide opacity-60">
              Radar ≠ Reddit — tripwires on official feeds
            </p>
            <p className="mt-2 m-0 text-[14px] font-bold leading-snug">
              {radar?.summary ||
                "Watching SEBI / Hugging Face / BBC Business. A trip means a new item appeared since the last check."}
            </p>
            {radar?.clear !== false && !(radar?.trips?.length) ? null : (
              <ul className="mt-3 m-0 list-none space-y-2 p-0">
                {(radar?.trips ?? []).map((t) => (
                  <li key={t.id} className="text-[14px] font-black">
                    🔴 {t.name}
                    {t.blurb ? ` — ${t.blurb}` : ""}
                    <span className="mt-1 block text-[13px] font-bold opacity-80">
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {section !== "vibe" && section !== "radar" && !quietHero ? (
          <BentoGrid
            key={`${section}-${timeWindow}-${lens}`}
            items={visibleItems}
            loading={showSkeleton}
            section={section}
            window={timeWindow}
            onTryWiderWindow={() =>
              setTimeWindow(nextWiderWindow(timeWindow))
            }
            onOpenBrief={onOpenBrief}
          />
        ) : null}

        <StatusBar
          generatedAt={
            section === "vibe"
              ? vibe?.generatedAt ?? null
              : data && data.section === section
                ? data.generatedAt
                : null
          }
          lastVisit={lastVisitRef.current}
          refreshing={refreshing || vibeLoading}
          onRefresh={() => {
            if (section === "vibe") void loadVibe();
            else if (section === "radar") void loadRadar();
            else
              void load(section, timeWindow, lens, {
                refresh: true,
                soft: true,
              });
          }}
          xPulseUsage={
            (section === "xpulse" && data?.section === "xpulse"
              ? data.xPulseUsage
              : undefined) || vibe?.xPulseUsage
          }
        />
      </div>

      <BriefOverlay
        open={briefOpen}
        loading={briefLoading}
        brief={brief}
        onClose={() => setBriefOpen(false)}
      />
    </div>
  );
}
