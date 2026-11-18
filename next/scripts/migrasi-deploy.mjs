/**
 * prebuild: jalankan migrasi tertunda di build produksi Vercel (lihat src/db/migrasi-deploy.ts).
 * Di luar produksi Vercel tidak melakukan apa-apa.
 */
import { spawnSync } from "node:child_process";

if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
  const r = spawnSync("npx", ["tsx", "src/db/migrasi-deploy-cli.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(r.status ?? 1);
} else {
  console.log("migrasi-deploy: bukan build produksi Vercel, dilewati.");
}
