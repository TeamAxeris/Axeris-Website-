import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "playwright-results.xml" }],
    ["list"],
  ],
  use: {
    baseURL: "https://proto2-mocha.vercel.app",
    // Give the remote Vercel + Render backend enough headroom
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    // video disabled — requires FFmpeg binary not available in this environment
    video: "off",
    // trace on retry for debugging failures
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the system-installed Chrome instead of downloading a separate binary
        channel: "chrome",
      },
    },
  ],
  // No local webServer — tests run against the live Vercel deployment
  timeout: 60_000,
});
