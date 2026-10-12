import { defineConfig, devices } from "@playwright/test";

// Scenarios de bout en bout (e2e/*.spec.js) : npm run test:e2e -w @hope/web
//
// - En CI (process.env.CI), Playwright demarre lui-meme l'API et le site de production
//   (webServer ci-dessous) apres migration et seed de la base (voir .github/workflows/ci.yml).
// - En local, aucun serveur n'est demarre : lancer l'API et le site soi-meme, puis
//   E2E_BASE_URL=http://localhost:3001 npm run test:e2e -w @hope/web
const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3001";
const apiHealth = process.env.E2E_API_HEALTH || "http://localhost:5000/api/health";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isCI
    ? [
        {
          name: "api",
          command: "npm run start -w @hope/api",
          cwd: "../..",
          url: apiHealth,
          timeout: 120_000,
          reuseExistingServer: false,
          stdout: "pipe",
        },
        {
          name: "web",
          command: "npm run start -w @hope/web",
          cwd: "../..",
          url: baseURL,
          timeout: 120_000,
          reuseExistingServer: false,
          stdout: "pipe",
        },
      ]
    : undefined,
});
