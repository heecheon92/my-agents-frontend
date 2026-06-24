import baseConfig from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: "http://127.0.0.1:3104",
  },
  webServer: {
    command: "pnpm exec next dev --webpack --port 3104 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3104",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
