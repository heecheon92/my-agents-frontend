import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "MY_AGENTS_BACKEND_URL=http://localhost:8000 pnpm exec next dev . --webpack --hostname localhost --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 90_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
