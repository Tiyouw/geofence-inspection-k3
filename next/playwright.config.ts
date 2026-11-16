import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E memakai basis data yang sudah dimigrasi dan di-seed (DEMO_MODE=true).
 * Lokal: pnpm db:migrate && pnpm db:seed, lalu pnpm test:e2e.
 * CI: server produksi (next build && next start) dijalankan oleh webServer di bawah.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /petugas/ },
    { name: "ponsel", use: { ...devices["Pixel 7"] }, testMatch: /petugas/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
        url: `${baseURL}/masuk`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
