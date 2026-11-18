/**
 * Migrasi otomatis saat build produksi Vercel (dev.geofencinspection.tech, cabang rewrite/next).
 *
 * Insiden 18 Nov 2026: PR #39 menambah kolom schedules.tanggal_rencana (migrasi 0003), tetapi
 * migrasi ke Neon masih langkah manual dan terlewat. Kode baru ter-deploy ke skema lama, sehingga
 * /admin/jadwal gagal 500 ("column does not exist") dan seluruh panel admin tampak macet.
 *
 * Sekarang `prebuild` menjalankan berkas ini. Di build produksi Vercel, migrasi yang tertunda
 * dijalankan sebelum `next build`; bila ada pernyataan berisiko (bukan aditif, lihat
 * ARCHITECTURE §4.2), build DIGAGALKAN supaya versi lama tetap melayani dan manusia memutuskan.
 * Di luar produksi Vercel (lokal, CI, preview) tidak melakukan apa-apa.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type EntriJurnal = { idx: number; tag: string };

/** Hash yang dicatat drizzle di drizzle.__drizzle_migrations: sha256 isi berkas SQL. */
export function hashMigrasi(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

/** Migrasi di jurnal yang hash-nya belum tercatat di basis data, urut jurnal. */
export function migrasiTertunda(jurnal: EntriJurnal[], isiSql: (tag: string) => string, tercatat: Set<string>): string[] {
  return [...jurnal].sort((a, b) => a.idx - b.idx).filter((e) => !tercatat.has(hashMigrasi(isiSql(e.tag)))).map((e) => e.tag);
}

/**
 * Pernyataan yang bukan aditif: menghapus, mengganti nama, mengubah tipe, atau mewajibkan isi
 * kolom yang sudah ada. Menambah tabel/kolom/indeks (nullable atau berdefault) dianggap aman.
 */
const POLA_BERISIKO: [RegExp, string][] = [
  [/\bdrop\s+(table|column|schema|type|constraint)\b/i, "DROP"],
  [/\brename\b/i, "RENAME"],
  [/\balter\s+column\s+"?[\w]+"?\s+(set\s+data\s+)?type\b/i, "ubah tipe kolom"],
  [/\bset\s+not\s+null\b/i, "SET NOT NULL"],
  [/\btruncate\b/i, "TRUNCATE"],
  [/\bdelete\s+from\b/i, "DELETE"],
];

export function pernyataanBerisiko(sql: string): string[] {
  return POLA_BERISIKO.filter(([p]) => p.test(sql)).map(([, nama]) => nama);
}

export function harusMigrasi(env: Record<string, string | undefined>): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && !!(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
}

/** Dijalankan oleh scripts/migrasi-deploy.mjs (prebuild). */
export async function jalankan(dir = process.cwd(), env: Record<string, string | undefined> = process.env): Promise<void> {
  if (!harusMigrasi(env)) {
    console.log("migrasi-deploy: bukan build produksi Vercel, dilewati.");
    return;
  }
  const folder = join(dir, "drizzle");
  const jurnal = (JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")) as { entries: EntriJurnal[] }).entries;
  const isiSql = (tag: string) => readFileSync(join(folder, `${tag}.sql`), "utf8");

  const { Client } = await import("pg");
  const client = new Client({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL });
  await client.connect();
  try {
    const ada = await client
      .query<{ hash: string }>("select hash from drizzle.__drizzle_migrations")
      .then((r) => r.rows.map((x) => x.hash))
      .catch(() => [] as string[]);
    const tertunda = migrasiTertunda(jurnal, isiSql, new Set(ada));
    if (!tertunda.length) {
      console.log("migrasi-deploy: skema sudah terbaru.");
      return;
    }
    const berisiko = tertunda.map((t) => ({ t, p: pernyataanBerisiko(isiSql(t)) })).filter((x) => x.p.length);
    if (berisiko.length) {
      throw new Error(
        `migrasi-deploy: migrasi tidak aditif, jalankan manual setelah ditinjau: ${berisiko.map((x) => `${x.t} (${x.p.join(", ")})`).join("; ")}`,
      );
    }
    console.log(`migrasi-deploy: menjalankan ${tertunda.join(", ")}`);
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(drizzle({ client }), { migrationsFolder: folder });
    console.log("migrasi-deploy: selesai.");
  } finally {
    await client.end();
  }
}
