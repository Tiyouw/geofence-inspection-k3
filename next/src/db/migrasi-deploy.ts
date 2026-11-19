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

export type EntriJurnal = { idx: number; tag: string; when?: number };

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
  [/\bdrop\s+(table|column|schema|type|constraint|index)\b/i, "DROP"],
  [/\bdrop\s+default\b/i, "DROP DEFAULT"],
  [/\balter\s+type\s+[\w."]+\s+add\s+value\b/i, "ALTER TYPE ADD VALUE"],
  // Mengubah data yang sudah ada (audit 19 Nov 2026, S5): jalankan manual setelah ditinjau.
  [/\bupdate\s+[\w."]+\s+set\b/i, "UPDATE data"],
  [/\binsert\s+into\b/i, "INSERT data"],
  [/\brename\b/i, "RENAME"],
  [/\balter\s+column\s+"?[\w]+"?\s+(set\s+data\s+)?type\b/i, "ubah tipe kolom"],
  [/\bset\s+not\s+null\b/i, "SET NOT NULL"],
  [/\btruncate\b/i, "TRUNCATE"],
  [/\bdelete\s+from\b/i, "DELETE"],
];

export function pernyataanBerisiko(sql: string): string[] {
  return POLA_BERISIKO.filter(([p]) => p.test(sql)).map(([, nama]) => nama);
}

/**
 * Drizzle (node-postgres migrator) hanya menjalankan migrasi yang `when`-nya lebih baru dari
 * created_at migrasi terakhir yang tercatat. Migrasi tertunda dengan `when` lebih lama (mis. urutan
 * merge cabang) akan DILEWATI diam-diam: tolak sebelum migrate (audit 19 Nov 2026, S4).
 */
export function tertundaTerlewati(jurnal: EntriJurnal[], tertunda: string[], terakhirMs: number | null): string[] {
  if (terakhirMs === null) return [];
  return jurnal.filter((e) => tertunda.includes(e.tag) && (e.when ?? 0) <= terakhirMs).map((e) => e.tag);
}

/** Kunci sesi Postgres supaya dua build produksi bersamaan tidak memigrasi berbarengan. */
export const KUNCI_MIGRASI = 7_202_611_19;

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
  const bacaTercatat = () =>
    client
      .query<{ hash: string; created_at: string | null }>("select hash, created_at from drizzle.__drizzle_migrations")
      .then((r) => r.rows)
      .catch(() => [] as { hash: string; created_at: string | null }[]);
  try {
    await client.query("select pg_advisory_lock($1)", [KUNCI_MIGRASI]);
    const ada = await bacaTercatat();
    const tertunda = migrasiTertunda(jurnal, isiSql, new Set(ada.map((x) => x.hash)));
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
    const terakhir = ada.reduce<number | null>((m, x) => (x.created_at == null ? m : Math.max(m ?? 0, Number(x.created_at))), null);
    const terlewati = tertundaTerlewati(jurnal, tertunda, terakhir);
    if (terlewati.length) {
      throw new Error(
        `migrasi-deploy: ${terlewati.join(", ")} lebih lama dari migrasi terakhir yang tercatat; drizzle akan melewatinya. Perbaiki "when" di jurnal atau jalankan manual.`,
      );
    }
    console.log(`migrasi-deploy: menjalankan ${tertunda.join(", ")}`);
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(drizzle({ client }), { migrationsFolder: folder });
    // Periksa ulang: yang masih tertunda berarti dilewati drizzle; gagalkan build.
    const sisa = migrasiTertunda(jurnal, isiSql, new Set((await bacaTercatat()).map((x) => x.hash)));
    if (sisa.length) throw new Error(`migrasi-deploy: setelah migrate masih tertunda: ${sisa.join(", ")}. Build digagalkan.`);
    console.log("migrasi-deploy: selesai.");
  } finally {
    await client.query("select pg_advisory_unlock($1)", [KUNCI_MIGRASI]).catch(() => {});
    await client.end();
  }
}
