import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.PW_PORT ?? "3100");
const BASE = `http://127.0.0.1:${PORT}`;

/** Isolated SQLite for M5 history writer under PW_TEST (moat clock + baselines). */
const HISTORY_DB = path.join(
  process.cwd(),
  "data",
  `e2e-pulsewire-${PORT}.db`
);
fs.mkdirSync(path.dirname(HISTORY_DB), { recursive: true });
// Only wipe the isolated e2e DB — never touch live data/pulsewire.db (moat clock).
for (const suffix of ["", "-shm", "-wal", ".bak"]) {
  try {
    fs.unlinkSync(HISTORY_DB + suffix);
  } catch {
    // fresh run
  }
}
for (const suffix of ["", "-shm", "-wal"]) {
  try {
    fs.unlinkSync(path.join(os.tmpdir(), `pulsewire-e2e-${PORT}.db`) + suffix);
  } catch {
    // ignore
  }
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE}/api/highlights?section=markets&window=1h`,
    // Always start our own server so PW_TEST=1 is guaranteed (never reuse a live-feed dev server).
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PW_TEST: "1",
      // Enable history writer under fixtures so M5 gate can assert persistence.
      PW_HISTORY: "1",
      PULSEWIRE_DB_PATH: HISTORY_DB,
      RAW_CACHE_TTL_MS: "300",
      CACHE_TTL_MINUTES: "10",
      MAX_ITEMS_PER_SECTION: "10",
    },
  },
});
