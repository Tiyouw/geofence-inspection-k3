/**
 * Data demo v2 (lihat demo.ts).
 *
 *   pnpm db:demo                    isi data demo (idempoten)
 *   pnpm db:demo -- --rencana       hanya hitung apa yang akan ditambahkan, lalu batalkan (tanpa unggah foto)
 *   pnpm db:demo:reset              hapus HANYA data demo
 *   pnpm db:demo:reset -- --rencana hanya hitung apa yang akan dihapus, lalu batalkan
 *
 * Jalankan `pnpm db:seed` lebih dulu (tipe aset, checklist, langkah foto, akun dasar).
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../schema";
import { hapusFoto, simpanFoto } from "../../lib/storage/photos";
import { hapusDemo, seedDemo, type Hitungan } from "./demo";

const perintah = process.argv[2];
const rencana = process.argv.includes("--rencana");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url || (perintah !== "seed" && perintah !== "reset")) {
  console.error("Pakai: demo-cli.ts seed|reset [--rencana]; DATABASE_URL wajib.");
  process.exit(2);
}
const pool = new Pool({ connectionString: url });
const db = drizzle({ client: pool, schema: s, casing: "snake_case" });

class Batalkan extends Error {}

function cetak(judul: string, h: Hitungan) {
  console.log(judul);
  for (const [k, v] of Object.entries(h)) if (v) console.log(`  ${k.padEnd(22)} ${v}`);
}

async function main() {
  // Hanya nama host, tanpa kredensial, supaya jelas basis data mana yang disentuh.
  console.log(`Basis data: ${new URL(url!).hostname}${rencana ? " (RENCANA: tidak ada yang disimpan)" : ""}`);
  if (perintah === "seed") {
    const terunggah: string[] = [];
    const fotoContoh = new Uint8Array(readFileSync(join(import.meta.dirname, "../../../public/icons/icon-192.png")));
    let hasil: Hitungan = {};
    try {
      await db.transaction(async (tx) => {
        hasil = await seedDemo(tx, {
          fotoContoh,
          simpanFoto: rencana
            ? null
            : async (key, data, type) => {
                await simpanFoto(key, data, type);
                terunggah.push(key);
              },
        });
        if (rencana) throw new Batalkan();
      });
    } catch (e) {
      if (!(e instanceof Batalkan)) {
        // Transaksi gagal: foto yang sudah terunggah dihapus lagi.
        for (const k of terunggah) await hapusFoto(k).catch(() => undefined);
        throw e;
      }
    }
    cetak(rencana ? "Akan ditambahkan:" : "Ditambahkan:", hasil);
  } else {
    let hasil: { hitungan: Hitungan; kunciFoto: string[] } = { hitungan: {}, kunciFoto: [] };
    try {
      await db.transaction(async (tx) => {
        hasil = await hapusDemo(tx);
        if (rencana) throw new Batalkan();
      });
    } catch (e) {
      if (!(e instanceof Batalkan)) throw e;
    }
    // Berkas foto dihapus setelah baris terhapus (tidak bisa dibatalkan, jadi tidak pada mode rencana).
    if (!rencana) for (const k of hasil.kunciFoto) await hapusFoto(k).catch((e) => console.warn(`Foto ${k} gagal dihapus: ${e}`));
    cetak(rencana ? "Akan dihapus (hanya data demo):" : "Dihapus (hanya data demo):", hasil.hitungan);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
