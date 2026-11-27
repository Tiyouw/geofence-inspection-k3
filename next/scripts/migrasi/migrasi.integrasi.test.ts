/**
 * Uji integrasi migrasi (ACCEPTANCE O1-O3, O5, dan isi PMS untuk O4) terhadap SQLite
 * yang dibangun dari seeder Laravel asli:
 *
 *   scripts/migrasi/buat-sqlite-uji.sh /tmp/laravel-uji
 *   createdb palk3_migrasi && DATABASE_URL=.../palk3_migrasi pnpm db:migrate
 *   MIGRASI_SQLITE=/tmp/laravel-uji/database.sqlite MIGRASI_FOTO=/tmp/laravel-uji/foto \
 *   MIGRASI_DATABASE_URL=postgres://.../palk3_migrasi pnpm exec vitest run scripts/migrasi
 *
 * Dilewati bila variabel di atas tidak diatur (CI biasa).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const SQLITE = process.env.MIGRASI_SQLITE;
const FOTO = process.env.MIGRASI_FOTO;
const URL_DB = process.env.MIGRASI_DATABASE_URL;

describe.skipIf(!SQLITE || !FOTO || !URL_DB)("migrasi dari SQLite Laravel", { timeout: 120_000 }, () => {
  let pool: pg.Pool;
  const q = async <T extends pg.QueryResultRow>(s: string, p: unknown[] = []) => (await pool.query<T>(s, p)).rows;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_DB });
    // Mulai dari basis data kosong (skema saja), supaya uji dapat diulang.
    await q(
      "truncate schedules, issue_events, issues, inspection_photos, inspection_answers, inspections, checklist_items, checklist_groups, assets, asset_types, audit_logs, sync_receipts, users, divisions restart identity cascade",
    );
  }, 90_000); // TRUNCATE banyak tabel bisa lambat di disk HDD.
  afterAll(async () => pool?.end());

  it("dry-run tidak menulis apa pun dan melaporkan audit", async () => {
    const { migrasi } = await import("../migrate-from-laravel");
    const l = await migrasi({ sqlite: SQLITE!, foto: FOTO!, jalankan: false, databaseUrl: URL_DB! });
    expect(l.galat).toBeNull();
    expect(l.selesai).toBe(true);
    expect(l.audit.fotoTanpaBerkas).toHaveLength(1);
    expect((await q<{ n: number }>("select count(*)::int n from inspections"))[0]!.n).toBe(0);
  });

  it("jalankan: jumlah sama, token sama persis, ulang tidak menggandakan (O2, O3)", async () => {
    const { migrasi } = await import("../migrate-from-laravel");
    const satu = await migrasi({ sqlite: SQLITE!, foto: FOTO!, jalankan: true, databaseUrl: URL_DB! });
    expect(satu.galat).toBeNull();
    expect(satu.verifikasi!.tokenSama).toBe(true);
    const dua = await migrasi({ sqlite: SQLITE!, foto: FOTO!, jalankan: true, databaseUrl: URL_DB! });
    expect(Object.values(dua.tabel).every((h) => h.baru === 0)).toBe(true);
    for (const [t, h] of Object.entries(dua.tabel)) {
      const [{ n }] = (await q<{ n: number }>(`select count(*)::int n from "${t}"`)) as [{ n: number }];
      expect(n, t).toBe(h.sumber - h.dilewati);
    }
  });

  it("foto: sha256 cocok dengan berkas sumber dan berkas tersimpan (O2)", async () => {
    const { bacaFoto, sha256Hex } = await import("../../src/lib/storage/photos");
    const foto = await q<{ storage_key: string; sha256: string; legacy: number }>(
      "select p.storage_key, p.sha256, i.legacy_id legacy from inspection_photos p join inspections i on i.id = p.inspection_id",
    );
    expect(foto.length).toBeGreaterThan(0);
    for (const f of foto) {
      const simpan = await bacaFoto(f.storage_key);
      expect(simpan, f.storage_key).not.toBeNull();
      const isi = Buffer.from(await new Response(simpan!.stream).arrayBuffer());
      expect(sha256Hex(isi)).toBe(f.sha256);
    }
    // Contoh satu berkas sumber dibandingkan langsung.
    const { readdir } = await import("node:fs/promises");
    const dir = join(FOTO!, "inspeksi", String(foto[0]!.legacy));
    const [nama] = await readdir(dir);
    expect(sha256Hex(await readFile(join(dir, nama!)))).toBe(foto[0]!.sha256);
  });

  it("akun lama masuk dengan sandi lama; akun demo di-hash (O5)", async () => {
    const [u] = await q<{ password_hash: string }>("select password_hash from users where nip = '2001'");
    expect(u!.password_hash.startsWith("$2y$")).toBe(true);
    expect(await bcrypt.compare("sandi-lama-uji", u!.password_hash)).toBe(true);
    const [demo] = await q<{ password_hash: string; is_demo: boolean }>("select password_hash, is_demo from users where nip = 'admin'");
    expect(demo!.is_demo).toBe(true);
    expect(await bcrypt.compare("admin123", demo!.password_hash)).toBe(true);
    const [sup] = await q<{ role: string }>("select role from users where nip = '3002'");
    expect(sup!.role).toBe("pemantau");
  });

  it("lembar PMS Oktober 2026 dari data hasil migrasi sama dengan sampel Laravel (O4)", async () => {
    process.env.DATABASE_URL = URL_DB;
    const { ambilDataPeriode } = await import("../../src/features/laporan/queries");
    const d = (await ambilDataPeriode({ tipe: "apar", tahun: 2026, bulan: 10, gedung: null }))!;
    expect(d.ringkas).toMatchObject({ total: 35, diperiksa: 30, belum: 5, kepatuhan: 85.7, layak: 24, layakCatatan: 3, tidakLayak: 3, beratTerbuka: 3 });
    // Laravel menghitung 4 (perlu_review); v2 memakai definisi antrean: satu sudah ditinjau (§9 #8).
    expect(d.ringkas.perluTinjauan).toBe(3);
    expect(d.baris.slice(0, 5).map((b) => b.aset.kode)).toEqual(["31D", "32D", "33D", "34D", "35D"]);
    expect(d.baris[0]!.simbol.join("")).toBe("ØOOOOOOOOO");
    expect(d.baris.find((b) => b.aset.kode === "34D")!.kesimpulan).toBe("Belum diperiksa");
    const { db } = await import("../../src/db");
    await (db.$client as pg.Pool).end();
  });
});
