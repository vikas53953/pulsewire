import { defineConfig, devices } from "@playwright/test";

/**
 * Human-simulation suite — real feeds, no PW_TEST.
 * Usage:
 *   npm run test:human
 *   HUMAN_BASE_URL=https://your-beta-host npm run test:human
 * Never tunnel with PW_TEST=1.
 */
const PORT = Number(process.env.PW_HUMAN_PORT ?? "3200");
const EXTERNAL = (process.env.HUMAN_BASE_URL || "").replace(/\/$/, "");
const BASE = EXTERNAL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/live-sanity",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-human" }],
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "on",
    video: "off",
    extraHTTPHeaders: process.env.BETA_TOKEN
      ? { Authorization: `Bearer ${process.env.BETA_TOKEN}` }
      : undefined,
  },
  projects: [
    {
      name: "human-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "human-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: EXTERNAL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `${BASE}/api/health`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          ...process.env,
          // Critical: do not set PW_TEST — real feeds only.
          PW_TEST: "",
          CACHE_TTL_MINUTES: "5",
        },
      },
});
