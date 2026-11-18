/** Titik masuk prebuild (scripts/migrasi-deploy.mjs → tsx). */
import { jalankan } from "./migrasi-deploy";

jalankan().catch((e: Error) => {
  console.error(e.message || String(e));
  process.exitCode = 1;
});
