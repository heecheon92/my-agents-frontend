import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  /**
   * Every test shares the one `pnpm dev` server started below. With parallel
   * workers, several tests hit a route Next has not compiled yet and race its
   * first compile against the 5s `expect` timeout — producing failures that
   * pass in isolation. Serialising fixes it at a cost of roughly 20s; raising
   * the expect timeout instead would just mask genuine slow assertions.
   */
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "MY_AGENTS_BACKEND_URL=http://localhost:8000 pnpm dev --hostname localhost",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
