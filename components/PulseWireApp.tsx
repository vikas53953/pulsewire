"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BentoGrid, StaleBanner } from "@/components/BentoGrid";
import { BriefOverlay } from "@/components/BriefOverlay";
import { Header } from "@/components/Header";
import { RadarStrip } from "@/components/RadarStrip";
import { ScoreChips, type ChipId } from "@/components/ScoreChips";
import { StatusBar } from "@/components/StatusBar";
import { SocialTrendsBoard } from "@/components/SocialTrendsBoard";
import { FreshnessLine } from "@/components/FreshnessLine";
import { VerdictHero } from "@/components/VerdictHero";
import type { BriefPayload } from "@/lib/brief";
import type { RadarStatus } from "@/lib/radar";
import {
  applyNewBadges,
  readLastVisit,
  writeLastVisit,
} from "@/lib/last-visit";
import { DEVICE_HEADER, getOrCreateDeviceId } from "@/lib/device-id";
import { OnboardingLine } from "@/components/OnboardingLine";
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
const WINDOW_KEY = "pulsewire-window";

function readStoredWindow(): TimeWindow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    if (raw && (TIME_WINDOWS as readonly string[]).includes(raw)) {
      return raw as TimeWindow;
    }
  } catch {
    // ignore
  }
  return null;
}

type ClientCache = Map<string, HighlightsResponse>;

type PulseWireAppProps = {
  /** Server-fetched first paint — avoids empty shell for reviewers / slow JS. */
  initialData?: HighlightsResponse | null;
};

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
  return applyNewBadges(items, lastVisit);
}

function seedCache(
  map: ClientCache,
  data: HighlightsResponse,
  lastVisit: number | null,
): void {
  map.set(
    clientKey(data.section, data.window, data.lens, null),
    {
      ...data,
      items: markNewItems(data.items, lastVisit),
    },
  );
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
  // Forward PW_TEST page overrides (?pwQuiet=1, ?pwEarlyX=1, …) to the API.
  if (typeof window !== "undefined") {
    const page = new URLSearchParams(window.location.search);
    for (const key of [
      "pwQuiet",
      "pwHotMarkets",
      "pwLlmFail",
      "pwFeedsDown",
      "pwEmpty",
      "pwEarlyX",
      "pwFusion",
    ]) {
      const v = page.get(key);
      if (v) params.set(key, v);
    }
  }
  const res = await fetch(`/api/highlights?${params.toString()}`, {
    cache: "no-store",
    headers: {
      [DEVICE_HEADER]: getOrCreateDeviceId(),
    },
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

function socialFirstLine(item: HighlightItem): string | undefined {
  if (!item.firstSocialAt || !item.publishedAt) return undefined;
  const socialMs = new Date(item.firstSocialAt).getTime();
  const wireMs = new Date(item.publishedAt).getTime();
  if (!Number.isFinite(socialMs) || !Number.isFinite(wireMs)) return undefined;
  const mins = Math.round((wireMs - socialMs) / 60_000);
  if (mins < 1) return undefined;
  const hasX = (item.evidence || []).some((e) => e.plane === "x");
  if (!hasX && !item.socialLed) return undefined;
  return `First seen on X, ${mins} min before wires.`;
}

export function PulseWireApp({ initialData = null }: PulseWireAppProps) {
  const [section, setSection] = useState<SectionId>(
    initialData?.section ?? "all",
  );
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(
    () => readStoredWindow() ?? initialData?.window ?? "4h",
  );
  const [lens, setLens] = useState<Lens>(initialData?.lens ?? "window");
  const [data, setData] = useState<HighlightsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [night, setNight] = useState(readInitialNight);
  const [error, setError] = useState<string | null>(null);
  const [hasLastVisit, setHasLastVisit] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [radar, setRadar] = useState<RadarStatus | null>(null);
  const requestId = useRef(0);
  // Seed during first render so the load effect never flashes an empty shell.
  const clientCache = useRef<ClientCache | null>(null);
  if (clientCache.current === null) {
    clientCache.current = new Map();
    if (initialData) {
      seedCache(clientCache.current, initialData, null);
    }
  }
  const lastVisitRef = useRef<number | null>(null);

  useEffect(() => {
    recordSessionStart();
    const deviceId = getOrCreateDeviceId();
    const sessionStart = Date.now();
    // One open ping per browser session
    try {
      if (!sessionStorage.getItem("pw_open_sent")) {
        sessionStorage.setItem("pw_open_sent", "1");
        void fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "open", deviceId }),
          keepalive: true,
        }).catch(() => {
          // quiet
        });
      }
    } catch {
      // ignore
    }

    const lv = readLastVisit();
    lastVisitRef.current = lv;
    setHasLastVisit(lv != null);
    if (initialData && clientCache.current) {
      seedCache(clientCache.current, initialData, lv);
      setData((prev) =>
        prev ? { ...prev, items: markNewItems(prev.items, lv) } : prev,
      );
    }
    const onHide = () => {
      writeLastVisit(Date.now());
      const elapsed = Date.now() - sessionStart;
      const payload = JSON.stringify({
        event: "session",
        deviceId,
        sessionMs: elapsed,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/usage",
            new Blob([payload], { type: "application/json" }),
          );
        } else {
          void fetch("/api/usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        }
      } catch {
        // quiet
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
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
    try {
      localStorage.setItem(WINDOW_KEY, timeWindow);
    } catch {
      // ignore
    }
  }, [timeWindow]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // quiet
      });
    }
  }, []);

  const showFor = useCallback(
    (s: SectionId, w: TimeWindow, l: Lens) => {
      const since =
        l === "since" ? String(lastVisitRef.current ?? "") : null;
      return clientCache.current!.has(clientKey(s, w, l, since));
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
      if (
        targetSection === "vibe" ||
        targetSection === "radar" ||
        targetSection === "xpulse"
      ) {
        return;
      }
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
        clientCache.current!.set(key, json);
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
    const hit = showFor(section, timeWindow, lens);
    void load(section, timeWindow, lens, { soft: hit });
  }, [section, timeWindow, lens, load, showFor]);

  useEffect(() => {
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
          socialFirst: socialFirstLine(item),
        }),
      });
      if (!res.ok) throw new Error(`brief ${res.status}`);
      const payload = (await res.json()) as BriefPayload;
      setBrief({
        ...payload,
        socialFirst: payload.socialFirst || socialFirstLine(item),
      });
    } catch {
      setBrief({
        clusterId,
        title: item.text,
        lines: null,
        rawMode: true,
        cached: false,
        sources: item.sources.map((s) => ({ name: s.name, url: s.url })),
        socialFirst: socialFirstLine(item),
      });
    } finally {
      setBriefLoading(false);
    }
  };

  const showStale =
    Boolean(data?.stale) || Boolean(data?.sourcesUnreachable);

  const isTrend = section === "trend";
  const visibleItems =
    data && data.section === section && !isTrend ? data.items : [];
  const showSkeleton = loading || !data || data.section !== section;

  const quietTop =
    !isTrend &&
    data?.verdict?.level === "green" &&
    visibleItems[0]
      ? `Top of the quiet: ${visibleItems[0].text}`
      : null;

  const quietHero =
    !isTrend &&
    data?.verdict?.level === "green" &&
    !data?.verdict?.blind &&
    !data?.sourcesUnreachable &&
    !showSkeleton &&
    (data?.scores ?? []).length > 0 &&
    !(data?.scores ?? []).some((s) => s.unknown) &&
    (data?.scores ?? []).filter((s) => s.level === "green").length >=
      Math.ceil((data?.scores ?? []).length * 0.7);

  const displayVerdict: VerdictPayload | null = (() => {
    if (isTrend) return null;
    const radarRed =
      radar?.verdictHint?.level === "red" ? radar.verdictHint : null;
    if (radarRed) return radarRed;
    return showSkeleton ? null : data?.verdict ?? null;
  })();

  const chipActive: ChipId =
    section === "xpulse" || section === "vibe" || section === "radar"
      ? "all"
      : section === "trend"
        ? "trend"
        : (section as ContentSectionId | "all");

  const radarTripped = Boolean(radar && !radar.clear && radar.trips?.length);

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

        {radarTripped ? (
          <RadarStrip
            status={radar}
            active={false}
            onSelect={() => void loadRadar()}
          />
        ) : null}

        {!isTrend ? (
          <VerdictHero
            verdict={displayVerdict}
            quietTop={quietHero ? quietTop : null}
          />
        ) : null}

        <OnboardingLine />

        <ScoreChips
          scores={data?.scores ?? []}
          active={chipActive}
          onSelect={onChipSelect}
          drivingSection={
            !isTrend && data?.verdict?.drivingSection
              ? data.verdict.drivingSection
              : null
          }
        />

        <FreshnessLine
          generatedAt={
            data && data.section === section ? data.generatedAt : null
          }
        />

        <StaleBanner show={showStale && !showSkeleton && !isTrend} />

        {error ? (
          <div className="pw-tile bg-[var(--card)] p-4 text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Could not load — {error}
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

        {isTrend ? (
          <SocialTrendsBoard
            pack={
              data && data.section === "trend" ? data.socialTrends : undefined
            }
            loading={showSkeleton}
          />
        ) : !quietHero ? (
          <BentoGrid
            key={`${section}-${timeWindow}-${lens}`}
            items={visibleItems}
            loading={showSkeleton}
            section={section}
            window={timeWindow}
            blind={Boolean(data?.verdict?.blind || data?.sourcesUnreachable)}
            onTryWiderWindow={() =>
              setTimeWindow(nextWiderWindow(timeWindow))
            }
            onOpenBrief={onOpenBrief}
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
          onDeepRefresh={() => {
            void (async () => {
              try {
                const res = await fetch("/api/x-governor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "deep-refresh",
                    section: isTrend ? "all" : section,
                  }),
                });
                const body = await res.json();
                if (!res.ok) {
                  setError(
                    body?.decision?.reason ||
                      "Deep refresh denied (budget/cooldown)",
                  );
                  return;
                }
                void load(section, timeWindow, lens, {
                  refresh: true,
                  soft: true,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            })();
          }}
          xPulseUsage={data?.xPulseUsage}
          xGovernor={data?.xGovernor}
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
