#!/usr/bin/env node
/**
 * Fail CI on high+ advisories except packages we consciously pin
 * (Next 14 is load-bearing for instrumentationHook; fixes require Next 15+).
 */
import { execSync } from "node:child_process";

const ALLOWED = new Set([
  "next",
  // Nested under next until a major bump:
  "postcss",
]);

let report;
try {
  execSync("npm audit --json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  report = { vulnerabilities: {} };
} catch (e) {
  const out = e.stdout?.toString?.() || "";
  try {
    report = JSON.parse(out);
  } catch {
    console.error("[audit-ci] could not parse npm audit JSON");
    process.exit(1);
  }
}

const bad = [];
for (const [name, meta] of Object.entries(report.vulnerabilities || {})) {
  const sev = meta.severity;
  if (sev !== "high" && sev !== "critical") continue;
  if (ALLOWED.has(name)) {
    console.info(`[audit-ci] accepted (pinned): ${name} (${sev})`);
    continue;
  }
  bad.push(`${name} (${sev})`);
}

if (bad.length) {
  console.error("[audit-ci] unexpected high/critical:", bad.join(", "));
  process.exit(1);
}
console.info("[audit-ci] ok — no unexpected high/critical advisories");
