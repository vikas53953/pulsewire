#!/usr/bin/env node
/**
 * Fable↔Grok wake-up loop — polls issue #12 every 10 minutes.
 * No tokens in this file. Uses GH_TOKEN / gh CLI from the environment.
 * State: .fable-loop-state.json (gitignored). Never commit secrets.
 *
 * Usage: nohup node scripts/fable-loop-watcher.mjs >> .fable-loop.log 2>&1 &
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.FABLE_REPO || "vikas53953/pulsewire";
const ISSUE = Number(process.env.FABLE_ISSUE || "12");
const INTERVAL_MS = Number(process.env.FABLE_POLL_MS || 10 * 60 * 1000);
const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, ".fable-loop-state.json");
const LOG_PATH = path.join(ROOT, ".fable-loop.log");

const FABLE_MARKERS = [
  /Fable review/i,
  /Work order/i,
  /\bSHIP\b/,
  /CONTINUE/i,
  /awaiting Vikas/i,
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + "\n");
  } catch {
    // ignore
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { lastCommentId: 0, lastMainSha: "", lastActionAt: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function ghJson(args) {
  const out = execFileSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function fetchComments() {
  // Prefer REST for stable numeric ids
  const comments = ghJson([
    "api",
    `repos/${REPO}/issues/${ISSUE}/comments`,
    "--paginate",
  ]);
  return Array.isArray(comments) ? comments : [];
}

function fetchMainSha() {
  try {
    const out = execFileSync(
      "git",
      ["ls-remote", "origin", "refs/heads/main"],
      { encoding: "utf8", env: process.env },
    );
    return (out.split(/\s+/)[0] || "").trim();
  } catch (err) {
    log(`ls-remote failed: ${err instanceof Error ? err.message : err}`);
    return "";
  }
}

function isFableComment(body) {
  if (!body) return false;
  return FABLE_MARKERS.some((re) => re.test(body));
}

function classify(body) {
  // SHIP for prior batches may still direct the next batch — prefer act.
  if (/proceed to Batch|Work order — Batch|directive|fix before|pending/i.test(body)) {
    return "act";
  }
  if (/awaiting Vikas/i.test(body) && !/proceed to Batch/i.test(body)) {
    return "watch";
  }
  if (/\bSHIP\b.*loop complete/i.test(body) && !/proceed to Batch/i.test(body)) {
    return "watch";
  }
  if (/\bCONTINUE\b/i.test(body)) return "act";
  return "act";
}

function writeWakePrompt(commentId, body) {
  const promptPath = path.join(ROOT, ".fable-wake-prompt.txt");
  const text = [
    `Read issue #${ISSUE} in ${REPO} from comment ${commentId} onward and implement the directives.`,
    "Push to main with green CI and tests, then comment the tip SHA on #" + ISSUE + ".",
    "",
    "--- Fable comment ---",
    body.slice(0, 8000),
    "",
  ].join("\n");
  fs.writeFileSync(promptPath, text);
  return promptPath;
}

function tryInvokeAgent(commentId, body) {
  const promptPath = writeWakePrompt(commentId, body);
  // Optional hook: set FABLE_WAKE_CMD to a command that starts a Cursor agent.
  // Example: FABLE_WAKE_CMD='cursor agent --prompt-file .fable-wake-prompt.txt'
  const cmd = (process.env.FABLE_WAKE_CMD || "").trim();
  if (!cmd) {
    log(
      `NEW Fable directive (comment ${commentId}) — wrote ${promptPath}. ` +
        `No FABLE_WAKE_CMD set; keep the agent session polling, or set FABLE_WAKE_CMD to self-invoke.`,
    );
    return false;
  }
  log(`Invoking wake command for comment ${commentId}: ${cmd}`);
  const child = spawn(cmd, {
    shell: true,
    cwd: ROOT,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return true;
}

function tick() {
  const state = loadState();
  let comments = [];
  try {
    comments = fetchComments();
  } catch (err) {
    log(`fetch comments failed: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const mainSha = fetchMainSha();
  if (mainSha && mainSha !== state.lastMainSha) {
    log(`main moved → ${mainSha.slice(0, 7)}`);
    state.lastMainSha = mainSha;
  }

  const newest = [...comments].sort((a, b) => a.id - b.id);
  const pending = newest.filter(
    (c) => c.id > (state.lastCommentId || 0) && isFableComment(c.body || ""),
  );

  if (pending.length === 0) {
    log(`idle — lastCommentId=${state.lastCommentId} comments=${comments.length}`);
    saveState(state);
    return;
  }

  for (const c of pending) {
    const body = c.body || "";
    const kind = classify(body);
    log(`Fable comment ${c.id} → ${kind}`);
    if (kind === "watch") {
      log("SHIP / awaiting Vikas — watching silently");
      state.lastCommentId = c.id;
      continue;
    }
    tryInvokeAgent(c.id, body);
    state.lastCommentId = c.id;
    state.lastActionAt = new Date().toISOString();
  }

  saveState(state);
}

function main() {
  log(`Fable watcher start — repo=${REPO} issue=#${ISSUE} every ${INTERVAL_MS}ms`);
  // Seed lastCommentId to newest existing so we don't re-fire on old work orders
  // unless FABLE_REPLAY=1.
  if (process.env.FABLE_REPLAY !== "1") {
    try {
      const comments = fetchComments();
      const state = loadState();
      if (!state.lastCommentId && comments.length) {
        const maxId = Math.max(...comments.map((c) => c.id));
        state.lastCommentId = maxId;
        state.lastMainSha = fetchMainSha();
        saveState(state);
        log(`seeded lastCommentId=${maxId} (set FABLE_REPLAY=1 to reprocess)`);
      }
    } catch (err) {
      log(`seed failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  tick();
  setInterval(tick, INTERVAL_MS);
}

main();
