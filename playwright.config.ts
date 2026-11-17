import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the demo: a production build started as a demo-only
 * deployment (DEMO_ONLY strips every key), so tests never reach a real account.
 */
const port = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { DEMO_ONLY: "true" },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
