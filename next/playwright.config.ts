import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Peladen tiruan Pusher (ADR K-12) untuk uji realtime. E2E_REALTIME=0 menjalankan tanpa realtime
 * (perilaku cadangan). Kunci di bawah hanya untuk peladen tiruan lokal.
 */
const REALTIME_PORT = Number(process.env.E2E_REALTIME_PORT ?? 6001);
const REALTIME = process.env.E2E_REALTIME !== "0" && !process.env.E2E_BASE_URL;
const ENV_REALTIME: Record<string, string> = REALTIME
  ? {
      PUSHER_APP_ID: "uji",
      PUSHER_KEY: "kunci-uji",
      PUSHER_SECRET: "rahasia-uji",
      PUSHER_HOST: `http://127.0.0.1:${REALTIME_PORT}`,
      PUSHER_WS_URL: `ws://127.0.0.1:${REALTIME_PORT}`,
    }
  : {};

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
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /petugas\/|akhir\/|demo\// },
    { name: "ponsel", use: { ...devices["Pixel 7"] }, testMatch: /petugas\// },
    // Uji yang mengubah keadaan bersama (mis. kawasan aktif): setelah semua uji lain selesai.
    { name: "akhir", use: { ...devices["Desktop Chrome"] }, testMatch: /akhir\//, dependencies: ["desktop", "ponsel"] },
    // Data demo: menambah lalu menghapus banyak baris dan membandingkan sidik data non-demo, jadi sendirian paling akhir.
    { name: "demo", use: { ...devices["Desktop Chrome"] }, testMatch: /demo\//, dependencies: ["akhir"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        ...(REALTIME
          ? [
              {
                command: `node e2e/realtime-tiruan.mjs ${REALTIME_PORT}`,
                url: `http://127.0.0.1:${REALTIME_PORT}/`,
                env: { ...(process.env as Record<string, string>), ...ENV_REALTIME },
                reuseExistingServer: !process.env.CI,
                timeout: 10_000,
              },
            ]
          : []),
        {
          command: process.env.CI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
          url: `${baseURL}/masuk`,
          env: { ...(process.env as Record<string, string>), ...ENV_REALTIME },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
