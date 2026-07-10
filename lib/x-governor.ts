import { getHistoryDb } from "./history";
import { isTestMode } from "./test-mode";
import type { ContentSectionId } from "./types";

export type XTrigger =
  | "heat_escalation"
  | "reddit_spike"
  | "tripwire"
  | "manual_deep";

export type XGovernorDecision = {
  allowed: boolean;
  reason: string;
  trigger?: XTrigger;
  section?: ContentSectionId | "all";
  dailyUsed: number;
  dailyCap: number;
  monthlyUsed: number;
  monthlyCap: number;
  paused: boolean;
};

export type XGovernorStatus = {
  dailyUsed: number;
  dailyCap: number;
  monthlyUsed: number;
  monthlyCap: number;
  paused: boolean;
  /** Honest strip when EARLY plane is dark */
  pauseNote: string | null;
  lastCall?: {
    trigger: XTrigger;
    section: string;
    at: string;
    reason: string;
  };
  manualDeepUsedToday: number;
  manualDeepCap: number;
};

const MANUAL_DEEP_DAILY = 4;

const globalForGov = globalThis as unknown as {
  __pwXGovLast?: {
    trigger: XTrigger;
    section: string;
    at: string;
    reason: string;
  };
  /** Test: force next decision */
  __pwXGovForceDeny?: boolean;
  __pwXGovForceAllow?: boolean;
};

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function getDailyCap(): number {
  return envInt("X_CALLS_DAILY_CAP", 20);
}

export function getCooldownMin(): number {
  return envInt("X_CALLS_COOLDOWN_MIN", 30);
}

export function getMonthlyCap(): number {
  // Prefer X_MONTHLY_CAP; fall back to legacy X_PULSE_MONTHLY_CAP
  if (process.env.X_MONTHLY_CAP != null) return envInt("X_MONTHLY_CAP", 300);
  return envInt("X_PULSE_MONTHLY_CAP", 300);
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // UTC day
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ensureGovTable(): void {
  getHistoryDb().exec(`
    CREATE TABLE IF NOT EXISTS x_governor (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS x_governor_cooldown (
      section TEXT PRIMARY KEY,
      last_call_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS x_governor_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger TEXT NOT NULL,
      section TEXT NOT NULL,
      reason TEXT NOT NULL,
      at TEXT NOT NULL
    );
  `);
}

function getCounter(key: string): number {
  ensureGovTable();
  const row = getHistoryDb()
    .prepare(`SELECT value FROM x_governor WHERE key = ?`)
    .get(key) as { value: number } | undefined;
  return row?.value ?? 0;
}

function setCounter(key: string, value: number): void {
  ensureGovTable();
  getHistoryDb()
    .prepare(
      `INSERT INTO x_governor (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, new Date().toISOString());
}

function bumpCounter(key: string): number {
  const next = getCounter(key) + 1;
  setCounter(key, next);
  return next;
}

function getCooldownAt(section: string): number | null {
  ensureGovTable();
  const row = getHistoryDb()
    .prepare(`SELECT last_call_at FROM x_governor_cooldown WHERE section = ?`)
    .get(section) as { last_call_at: string } | undefined;
  if (!row) return null;
  const t = new Date(row.last_call_at).getTime();
  return Number.isFinite(t) ? t : null;
}

function setCooldown(section: string, at = new Date().toISOString()): void {
  ensureGovTable();
  getHistoryDb()
    .prepare(
      `INSERT INTO x_governor_cooldown (section, last_call_at) VALUES (?, ?)
       ON CONFLICT(section) DO UPDATE SET last_call_at = excluded.last_call_at`,
    )
    .run(section, at);
}

function logCall(
  trigger: XTrigger,
  section: string,
  reason: string,
): void {
  ensureGovTable();
  const at = new Date().toISOString();
  getHistoryDb()
    .prepare(
      `INSERT INTO x_governor_log (trigger, section, reason, at) VALUES (?, ?, ?, ?)`,
    )
    .run(trigger, section, reason, at);
  globalForGov.__pwXGovLast = { trigger, section, at, reason };
  console.info(
    `[pulsewire] x-governor CALL trigger=${trigger} section=${section} reason=${reason.slice(0, 80)}`,
  );
}

export function getXGovernorStatus(): XGovernorStatus {
  const dailyCap = getDailyCap();
  const monthlyCap = getMonthlyCap();
  const dailyUsed = getCounter(`daily:${dayKey()}`);
  const monthlyUsed = getCounter(`monthly:${monthKey()}`);
  const manualDeepUsedToday = getCounter(`manual:${dayKey()}`);
  const paused = dailyUsed >= dailyCap || monthlyUsed >= monthlyCap;
  return {
    dailyUsed,
    dailyCap,
    monthlyUsed,
    monthlyCap,
    paused,
    pauseNote: paused
      ? "⚡ early-signal plane paused (daily budget) — wires & Reddit still live."
      : null,
    lastCall: globalForGov.__pwXGovLast,
    manualDeepUsedToday,
    manualDeepCap: MANUAL_DEEP_DAILY,
  };
}

/**
 * Ask permission for one x_search. Never polls on a timer —
 * caller must pass an earned trigger (SPEC v4 §4).
 */
export function requestXSearch(input: {
  trigger: XTrigger;
  section: ContentSectionId | "all";
  reason: string;
}): XGovernorDecision {
  const status = getXGovernorStatus();
  const base = {
    dailyUsed: status.dailyUsed,
    dailyCap: status.dailyCap,
    monthlyUsed: status.monthlyUsed,
    monthlyCap: status.monthlyCap,
    paused: status.paused,
    trigger: input.trigger,
    section: input.section,
  };

  if (globalForGov.__pwXGovForceDeny) {
    return {
      ...base,
      allowed: false,
      reason: "PW_TEST force deny",
      paused: true,
    };
  }

  if (status.monthlyUsed >= status.monthlyCap) {
    return {
      ...base,
      allowed: false,
      reason: `Monthly cap reached (${status.monthlyUsed}/${status.monthlyCap})`,
      paused: true,
    };
  }

  if (status.dailyUsed >= status.dailyCap) {
    return {
      ...base,
      allowed: false,
      reason: `Daily cap reached (${status.dailyUsed}/${status.dailyCap})`,
      paused: true,
    };
  }

  if (input.trigger === "manual_deep") {
    if (status.manualDeepUsedToday >= MANUAL_DEEP_DAILY) {
      return {
        ...base,
        allowed: false,
        reason: `Manual deep refresh cap (${MANUAL_DEEP_DAILY}/day)`,
        paused: status.paused,
      };
    }
  } else {
    // Per-section cooldown (manual bypasses section cooldown — still rate-limited daily)
    const cooldownMs = getCooldownMin() * 60_000;
    const last = getCooldownAt(input.section);
    if (last != null && Date.now() - last < cooldownMs) {
      const left = Math.ceil((cooldownMs - (Date.now() - last)) / 60_000);
      return {
        ...base,
        allowed: false,
        reason: `Cooldown: ${input.section} waited ${getCooldownMin()}m (${left}m left)`,
        paused: false,
      };
    }
  }

  if (globalForGov.__pwXGovForceAllow) {
    // Fall through to grant
  }

  // Grant
  const dailyUsed = bumpCounter(`daily:${dayKey()}`);
  const monthlyUsed = bumpCounter(`monthly:${monthKey()}`);
  if (input.trigger === "manual_deep") {
    bumpCounter(`manual:${dayKey()}`);
  }
  setCooldown(input.section);
  logCall(input.trigger, input.section, input.reason);

  return {
    allowed: true,
    reason: input.reason,
    trigger: input.trigger,
    section: input.section,
    dailyUsed,
    dailyCap: status.dailyCap,
    monthlyUsed,
    monthlyCap: status.monthlyCap,
    paused: dailyUsed >= status.dailyCap || monthlyUsed >= status.monthlyCap,
  };
}

/** After scores computed: earn X if section crossed yellow on RSS+Reddit heat. */
export function maybeEarnHeatEscalation(input: {
  section: ContentSectionId;
  /** Score from RSS+Reddit only (ignore X-led). */
  score: number;
  socialLed?: boolean;
}): XGovernorDecision | null {
  // PW_TEST: no auto-earn (fixtures would trip every request). Use API fixtures.
  if (isTestMode() && process.env.PW_X_GOV !== "1") return null;
  if (input.socialLed) return null; // brewing — not wire heat
  if (input.score < 40) {
    setCounter(`score:${input.section}`, Math.round(input.score));
    return null;
  }

  const prev = getCounter(`score:${input.section}`);
  const prevKey = `score_seen:${input.section}`;
  const seen = getCounter(prevKey);
  setCounter(`score:${input.section}`, Math.round(input.score));
  setCounter(prevKey, 1);

  // Only earn on a real cross: we previously observed below yellow.
  if (seen === 0) return null;
  if (prev >= 40) return null;

  return requestXSearch({
    trigger: "heat_escalation",
    section: input.section,
    reason: `${input.section} heat ${input.score} crossed 🟡 — check social velocity`,
  });
}

export function maybeEarnRedditSpike(input: {
  section: ContentSectionId;
  title: string;
  velocity: number;
  /** Baseline threshold — default 5.0 velocity proxy */
  threshold?: number;
}): XGovernorDecision | null {
  if (isTestMode() && process.env.PW_X_GOV !== "1") return null;
  const thr = input.threshold ?? 5;
  if (input.velocity < thr) return null;
  return requestXSearch({
    trigger: "reddit_spike",
    section: input.section,
    reason: `Reddit spike v=${input.velocity.toFixed(1)}: ${input.title.slice(0, 60)}`,
  });
}

export function maybeEarnTripwire(input: {
  section?: ContentSectionId;
  title: string;
  sourceName: string;
}): XGovernorDecision {
  if (isTestMode() && process.env.PW_X_GOV !== "1") {
    return {
      allowed: false,
      reason: "PW_TEST — tripwire x-earn skipped (set PW_X_GOV=1)",
      dailyUsed: getXGovernorStatus().dailyUsed,
      dailyCap: getDailyCap(),
      monthlyUsed: getXGovernorStatus().monthlyUsed,
      monthlyCap: getMonthlyCap(),
      paused: false,
      trigger: "tripwire",
      section: input.section ?? "markets",
    };
  }
  return requestXSearch({
    trigger: "tripwire",
    section: input.section ?? "markets",
    reason: `Tripwire ${input.sourceName}: ${input.title.slice(0, 60)}`,
  });
}

export function requestManualDeep(section: ContentSectionId | "all" = "all"): XGovernorDecision {
  return requestXSearch({
    trigger: "manual_deep",
    section,
    reason: "User long-press deep refresh",
  });
}

/** Test helpers */
export function resetXGovernorForTests(): void {
  ensureGovTable();
  getHistoryDb().exec(`
    DELETE FROM x_governor;
    DELETE FROM x_governor_cooldown;
    DELETE FROM x_governor_log;
  `);
  globalForGov.__pwXGovLast = undefined;
  globalForGov.__pwXGovForceDeny = undefined;
  globalForGov.__pwXGovForceAllow = undefined;
}

export function setXGovernorForceDenyForTests(v: boolean): void {
  globalForGov.__pwXGovForceDeny = v || undefined;
}

export function __testSetDailyUsed(n: number): void {
  setCounter(`daily:${dayKey()}`, n);
}
