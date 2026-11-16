/**
 * Bundel service worker: src/features/inspeksi/sw/index.ts → public/sw.js.
 * Dijalankan otomatis sebelum dev/build (predev, prebuild). public/sw.js tidak di-commit.
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const versi = createHash("sha256")
  .update(readFileSync("src/features/inspeksi/sw/index.ts"))
  .update(readFileSync("src/features/inspeksi/client/outbox.ts"))
  .update(readFileSync("src/features/inspeksi/client/db.ts"))
  .digest("hex")
  .slice(0, 10);

await build({
  entryPoints: ["src/features/inspeksi/sw/index.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: process.env.NODE_ENV === "production",
  define: { __SW_VERSION__: JSON.stringify(versi) },
  tsconfig: "tsconfig.json",
  logLevel: "warning",
});
console.log(`sw.js dibangun (versi ${versi})`);
