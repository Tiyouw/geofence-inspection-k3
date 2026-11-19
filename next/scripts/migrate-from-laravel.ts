/**
 * Migrasi data v1 dari SQLite Laravel ke Postgres v2 + foto ke Blob privat (SPEC §8).
 *
 *   pnpm migrasi --sqlite ./pal-k3-ekspor.sqlite --foto ./storage-public            # dry-run (bawaan)
 *   pnpm migrasi --sqlite ./pal-k3-ekspor.sqlite --foto ./storage-public --jalankan # tulis sungguhan
 *   ... --laporan ./laporan-migrasi.json                                             # simpan laporan
 *
 * --foto menunjuk folder yang berisi `inspeksi/{id}/*.jpg` (salinan storage/app/public).
 * Tujuan: DATABASE_URL_UNPOOLED atau DATABASE_URL; foto lewat src/lib/storage/photos.ts
 * (Vercel Blob privat bila BLOB_READ_WRITE_TOKEN ada, selain itu next/.data/foto).
 *
 * Sifat (SPEC §8.2):
 * - Dry-run bawaan: seluruh penulisan dijalankan di satu transaksi lalu DIBATALKAN, jadi
 *   validasi basis data (FK, unik, enum) benar-benar teruji tanpa mengubah apa pun, dan
 *   tidak ada foto yang diunggah.
 * - Dapat diulang: id dipertahankan (integer) atau UUIDv5 deterministik (inspeksi, jawaban,
 *   foto) + upsert; foto yang sudah ada dengan sha256 sama tidak diunggah ulang.
 * - SQLite sumber dibuka hanya-baca. Tidak pernah menyentuh tc-vps.
 * - Laporan jumlah per tabel, nilai di luar enum, foto yatim, draf ganda.
 *
 * Catatan: menjalankan ulang SETELAH v2 dipakai akan menimpa baris yang sama (mis. sandi
 * yang sudah diganti). Ulangi hanya sebelum cut-over.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import pg from "pg";
import { kunciFoto, sha256Hex, simpanFoto } from "../src/lib/storage/photos";
import {
  AKUN_DEMO,
  NilaiTakDikenal,
  bool,
  idFoto,
  idInspeksi,
  idJawaban,
  json,
  kesimpulan,
  peran,
  statusGerbang,
  statusInspeksi,
  statusJadwal,
  statusTemuan,
  sudahBcrypt,
  tanggal,
  tingkat,
  tipeJawaban,
  tipeLokasi,
  ukuranGambar,
  waktuWib,
} from "./migrasi/peta";

type Baris = Record<string, unknown>;
type Hitung = { sumber: number; baru: number; diperbarui: number; dilewati: number };

export type LaporanMigrasi = {
  mode: "dry-run" | "jalankan";
  selesai: boolean;
  tabel: Record<string, Hitung>;
  audit: {
    diLuarEnum: string[];
    nilaiLebih32: number;
    draf: number;
    drafGandaDilewati: number[];
    fotoTanpaBerkas: string[];
    berkasTanpaBaris: string[];
    finalTanpaWaktu: number[];
  };
  verifikasi: { tokenSama: boolean; jumlahSama: Record<string, boolean> } | null;
  galat: string | null;
};

const TABEL_SUMBER = [
  "divisions",
  "users",
  "asset_types",
  "assets",
  "checklist_groups",
  "checklist_items",
  "inspections",
  "inspection_answers",
  "inspection_photos",
  "issues",
  "schedules",
] as const;

/** Tabel dengan id integer identity yang dipertahankan dari Laravel. */
const TABEL_IDENTITAS = ["divisions", "users", "asset_types", "assets", "checklist_groups", "checklist_items", "issues", "schedules"];

async function upsert(c: pg.PoolClient, tabel: string, rows: Baris[], kunci: string[], identitas: boolean, h: Hitung) {
  for (let i = 0; i < rows.length; i += 200) {
    const potong = rows.slice(i, i + 200);
    if (!potong.length) continue;
    const kolom = Object.keys(potong[0]!);
    const nilai: unknown[] = [];
    const tuple = potong.map((r) => `(${kolom.map((k) => (nilai.push(r[k]), `$${nilai.length}`)).join(", ")})`);
    const set = kolom.filter((k) => !kunci.includes(k)).map((k) => `"${k}" = excluded."${k}"`);
    const sqlText =
      `insert into "${tabel}" (${kolom.map((k) => `"${k}"`).join(", ")}) ${identitas ? "overriding system value " : ""}` +
      `values ${tuple.join(", ")} on conflict (${kunci.map((k) => `"${k}"`).join(", ")}) do update set ${set.join(", ")} ` +
      `returning (xmax = 0) as baru`;
    const res = await c.query<{ baru: boolean }>(sqlText, nilai);
    for (const r of res.rows) {
      if (r.baru) h.baru++;
      else h.diperbarui++;
    }
  }
}

async function semuaBerkas(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function jalan(d: string) {
    let isi;
    try {
      isi = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of isi) {
      const p = join(d, e.name);
      if (e.isDirectory()) await jalan(p);
      else out.push(relative(dir, p).split("\\").join("/"));
    }
  }
  await jalan(dir);
  return out;
}

const jsonb = (v: unknown) => (v == null ? null : JSON.stringify(v));

export async function migrasi(opts: {
  sqlite: string;
  foto: string;
  jalankan: boolean;
  databaseUrl: string;
  log?: (s: string) => void;
}): Promise<LaporanMigrasi> {
  const log = opts.log ?? (() => {});
  const lama = new DatabaseSync(opts.sqlite, { readOnly: true });
  const ambil = (t: string): Baris[] => lama.prepare(`select * from "${t}" order by id`).all() as Baris[];
  const laporan: LaporanMigrasi = {
    mode: opts.jalankan ? "jalankan" : "dry-run",
    selesai: false,
    tabel: {},
    audit: { diLuarEnum: [], nilaiLebih32: 0, draf: 0, drafGandaDilewati: [], fotoTanpaBerkas: [], berkasTanpaBaris: [], finalTanpaWaktu: [] },
    verifikasi: null,
    galat: null,
  };
  const h = (t: string, sumber: number) => (laporan.tabel[t] = { sumber, baru: 0, diperbarui: 0, dilewati: 0 });

  /** Kumpulkan nilai di luar enum alih-alih berhenti di yang pertama. */
  function aman<T>(f: () => T, cadangan: T): T {
    try {
      return f();
    } catch (e) {
      if (e instanceof NilaiTakDikenal) {
        laporan.audit.diLuarEnum.push(e.message);
        return cadangan;
      }
      throw e;
    }
  }

  const src = Object.fromEntries(TABEL_SUMBER.map((t) => [t, ambil(t)])) as Record<(typeof TABEL_SUMBER)[number], Baris[]>;
  lama.close();

  const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 1 });
  const c = await pool.connect();
  try {
    await c.query("begin");

    // Pemeriksaan awal: kunci alami yang sudah dipakai baris lain dengan id berbeda (mis. seed v2).
    const bentrok: string[] = [];
    for (const [t, kol, nilaiDari] of [
      ["divisions", "kode", (r: Baris) => r.kode],
      ["users", "nip", (r: Baris) => r.nip],
      ["asset_types", "slug", (r: Baris) => r.slug],
      ["assets", "qr_token", (r: Baris) => r.qr_token],
    ] as const) {
      const peta = new Map(src[t].filter((r) => nilaiDari(r) != null).map((r) => [String(nilaiDari(r)), Number(r.id)]));
      const ada = await c.query<{ id: number; k: string }>(`select id, "${kol}" as k from "${t}"`);
      for (const r of ada.rows) {
        const idSumber = peta.get(r.k);
        if (idSumber !== undefined && idSumber !== r.id) bentrok.push(`${t}.${kol}=${t === "assets" ? "(token)" : r.k} id tujuan ${r.id} ≠ sumber ${idSumber}`);
      }
    }
    if (bentrok.length) {
      throw new Error(
        `Basis data tujuan sudah berisi data lain (mis. seed v2) dengan kunci yang sama: ${bentrok.slice(0, 5).join("; ")}` +
          `${bentrok.length > 5 ? ` (+${bentrok.length - 5})` : ""}. Migrasikan ke basis data kosong (hanya dimigrasi skema).`,
      );
    }

    // 1. Data induk, id dipertahankan.
    await upsert(
      c,
      "divisions",
      src.divisions.map((r) => ({
        id: r.id,
        nama: r.nama,
        kode: r.kode ?? null,
        aktif: bool(r.aktif),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("divisions", src.divisions.length),
    );

    const users: Baris[] = [];
    for (const r of src.users) {
      const sandi = String(r.password ?? "");
      const demo = AKUN_DEMO.includes(String(r.nip)) && !sudahBcrypt(sandi);
      users.push({
        id: r.id,
        nip: r.nip ?? `tanpa-nip-${r.id}`,
        name: r.name,
        email: r.email ?? null,
        // Hash $2y$ Laravel diterima bcryptjs apa adanya; teks biasa (akun demo) di-hash ulang.
        password_hash: sudahBcrypt(sandi) ? sandi : await bcrypt.hash(sandi || crypto.randomUUID(), 10),
        role: aman(() => peran(r.role), "inspektur"),
        jabatan: r.jabatan ?? null,
        division_id: r.division_id ?? null,
        aktif: bool(r.aktif),
        is_demo: demo,
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      });
    }
    await upsert(c, "users", users, ["id"], true, h("users", src.users.length));

    await upsert(
      c,
      "asset_types",
      src.asset_types.map((r) => ({
        id: r.id,
        slug: r.slug,
        nama: r.nama,
        is_mobile: bool(r.is_mobile),
        periode_hari: r.periode_hari ?? 30,
        urut: r.urut ?? 0,
        aktif: bool(r.aktif),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("asset_types", src.asset_types.length),
    );

    await upsert(
      c,
      "assets",
      src.assets.map((r) => ({
        id: r.id,
        asset_type_id: r.asset_type_id,
        division_id: r.division_id ?? null,
        kode: r.kode,
        gedung: r.gedung ?? null,
        lantai: r.lantai ?? null,
        lokasi_teks: r.lokasi_teks ?? "",
        lokasi_tipe: aman(() => tipeLokasi(r.lokasi_tipe), "dalam_gedung"),
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        radius_m: r.radius_m ?? null,
        // Disalin persis: stiker yang tertempel harus tetap berlaku (SPEC §2.4).
        qr_token: r.qr_token,
        attributes: jsonb(json(r.attributes as string)),
        tgl_expired: tanggal(r.tgl_expired as string),
        terakhir_dicek: tanggal(r.terakhir_dicek as string),
        aktif: bool(r.aktif),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("assets", src.assets.length),
    );

    await upsert(
      c,
      "checklist_groups",
      src.checklist_groups.map((r) => ({
        id: r.id,
        asset_type_id: r.asset_type_id,
        kode: r.kode ?? null,
        nama: r.nama,
        urut: r.urut ?? 0,
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("checklist_groups", src.checklist_groups.length),
    );

    await upsert(
      c,
      "checklist_items",
      src.checklist_items.map((r) => ({
        id: r.id,
        checklist_group_id: r.checklist_group_id,
        label: r.label,
        answer_type: aman(() => tipeJawaban(r.answer_type), "text"),
        options: jsonb(json(r.options as string)),
        severity_map: jsonb(json(r.severity_map as string)),
        severity_default: aman(() => tingkat("checklist_items.severity_default", r.severity_default ?? "sedang"), "sedang"),
        jumlah_baku: r.jumlah_baku ?? null,
        satuan: r.satuan ?? null,
        dasar_hukum: r.dasar_hukum ?? null,
        keterangan: r.keterangan ?? null,
        wajib: bool(r.wajib),
        urut: r.urut ?? 0,
        aktif: bool(r.aktif),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("checklist_items", src.checklist_items.length),
    );

    // 2. Inspeksi: id lama → UUIDv5. Satu draf per (aset, inspektur) di v2 (indeks unik parsial):
    //    draf ganda lama dilewati kecuali yang terbaru, dan dilaporkan.
    const status = new Map(src.inspections.map((r) => [Number(r.id), aman(() => statusInspeksi(r.status), "draf" as const)]));
    const drafTerbaru = new Map<string, number>();
    for (const r of src.inspections) {
      if (status.get(Number(r.id)) !== "draf") continue;
      const k = `${r.asset_id}:${r.user_id}`;
      drafTerbaru.set(k, Math.max(drafTerbaru.get(k) ?? 0, Number(r.id)));
    }
    const dilewati = new Set<number>();
    const hIns = h("inspections", src.inspections.length);
    const inspeksi: Baris[] = [];
    for (const r of src.inspections) {
      const id = Number(r.id);
      const st = status.get(id)!;
      if (st === "draf") {
        laporan.audit.draf++;
        if (drafTerbaru.get(`${r.asset_id}:${r.user_id}`) !== id) {
          dilewati.add(id);
          laporan.audit.drafGandaDilewati.push(id);
          hIns.dilewati++;
          continue;
        }
      }
      let inspectedAt = waktuWib(r.inspected_at as string);
      if (st === "final" && !inspectedAt) {
        laporan.audit.finalTanpaWaktu.push(id);
        inspectedAt = waktuWib(r.updated_at as string);
      }
      inspeksi.push({
        id: idInspeksi(id),
        legacy_id: id,
        asset_id: r.asset_id,
        user_id: r.user_id,
        status: st,
        scanned_at_device: null,
        submitted_at_device: waktuWib(r.device_time as string),
        received_at: inspectedAt,
        inspected_at: inspectedAt,
        mulai_pada: waktuWib(r.mulai_pada as string),
        durasi_detik: r.durasi_detik ?? null,
        offline: false,
        ua: r.ua == null ? null : String(r.ua).slice(0, 255),
        gps_lat: r.gps_lat ?? null,
        gps_lng: r.gps_lng ?? null,
        gps_accuracy: r.gps_accuracy ?? null,
        jarak_m: r.jarak_m ?? null,
        gate_status: aman(() => statusGerbang(r.gate_status ?? "tanpa_gps"), "tanpa_gps"),
        qr_verified: bool(r.qr_verified),
        qr_verification: bool(r.qr_verified) ? "online" : null,
        kesimpulan: aman(() => kesimpulan(r.kesimpulan), null),
        catatan: r.catatan ?? null,
        rekomendasi: r.rekomendasi ?? null,
        ditinjau_pada: waktuWib(r.ditinjau_pada as string),
        ditinjau_oleh: r.ditinjau_oleh ?? null,
        catatan_review: r.catatan_review ?? null,
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      });
    }
    await upsert(c, "inspections", inspeksi, ["id"], false, hIns);

    const hJaw = h("inspection_answers", src.inspection_answers.length);
    const jawaban = src.inspection_answers
      .filter((r) => {
        if (String(r.nilai ?? "").length > 32) laporan.audit.nilaiLebih32++;
        if (dilewati.has(Number(r.inspection_id))) return (hJaw.dilewati++, false);
        return true;
      })
      .map((r) => ({
        id: idJawaban(Number(r.id)),
        inspection_id: idInspeksi(Number(r.inspection_id)),
        checklist_item_id: r.checklist_item_id,
        nilai: r.nilai ?? null,
        nilai_angka: r.nilai_angka ?? null,
        catatan: r.catatan ?? null,
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      }));
    await upsert(c, "inspection_answers", jawaban, ["id"], false, hJaw);

    // 3. Foto: baca berkas, hash, ukuran; unggah hanya saat --jalankan dan hanya bila berubah.
    const hFoto = h("inspection_photos", src.inspection_photos.length);
    const berkasDipakai = new Set<string>();
    const fotoBaris: Baris[] = [];
    for (const r of src.inspection_photos) {
      const path = String(r.path);
      berkasDipakai.add(path);
      if (dilewati.has(Number(r.inspection_id))) {
        hFoto.dilewati++;
        continue;
      }
      let isi: Buffer;
      try {
        isi = await readFile(join(opts.foto, path));
      } catch {
        laporan.audit.fotoTanpaBerkas.push(path);
        hFoto.dilewati++;
        continue;
      }
      const id = idFoto(Number(r.id));
      const insId = idInspeksi(Number(r.inspection_id));
      const meta = ukuranGambar(isi);
      const contentType = meta?.contentType ?? "image/jpeg";
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const key = kunciFoto(insId, id, ext);
      const sha = sha256Hex(isi);
      if (opts.jalankan) {
        const ada = await c.query<{ sha256: string; storage_key: string }>("select sha256, storage_key from inspection_photos where id = $1", [id]);
        if (ada.rows[0]?.sha256 !== sha || ada.rows[0]?.storage_key !== key) await simpanFoto(key, isi, contentType);
      }
      fotoBaris.push({
        id,
        inspection_id: insId,
        storage_key: key,
        sha256: sha,
        content_type: contentType,
        bytes: isi.byteLength,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        taken_at_device: null,
        // taken_at Laravel = waktu unggah di peladen, bukan waktu jepret (SPEC §2.4).
        uploaded_at: waktuWib(r.taken_at as string) ?? waktuWib(r.created_at as string) ?? new Date(),
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      });
    }
    await upsert(c, "inspection_photos", fotoBaris, ["id"], false, hFoto);
    laporan.audit.berkasTanpaBaris = (await semuaBerkas(opts.foto)).filter((p) => p.startsWith("inspeksi/") && !berkasDipakai.has(p));

    // 4. Temuan dan jadwal: FK inspeksi lewat peta id.
    const insKe = (v: unknown) => (v == null || dilewati.has(Number(v)) ? null : idInspeksi(Number(v)));
    await upsert(
      c,
      "issues",
      src.issues.map((r) => ({
        id: r.id,
        asset_id: r.asset_id,
        inspection_id: insKe(r.inspection_id),
        checklist_item_id: r.checklist_item_id ?? null,
        item: r.item,
        severity: aman(() => tingkat("issues.severity", r.severity), "sedang"),
        status: aman(() => statusTemuan(r.status), "terbuka"),
        tindak_lanjut: r.tindak_lanjut ?? null,
        target_selesai: tanggal(r.target_selesai as string),
        selesai_pada: waktuWib(r.selesai_pada as string),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("issues", src.issues.length),
    );
    await upsert(
      c,
      "schedules",
      src.schedules.map((r) => ({
        id: r.id,
        asset_id: r.asset_id,
        periode: tanggal(r.periode as string),
        jatuh_tempo: tanggal(r.jatuh_tempo as string),
        inspection_id: insKe(r.inspection_id),
        status: aman(() => statusJadwal(r.status ?? "belum"), "belum"),
        created_at: waktuWib(r.created_at as string) ?? new Date(),
        updated_at: waktuWib(r.updated_at as string) ?? new Date(),
      })),
      ["id"],
      true,
      h("schedules", src.schedules.length),
    );

    // 5. Setel ulang identity ke max(id) supaya baris baru v2 tidak bentrok.
    for (const t of TABEL_IDENTITAS) {
      await c.query(`select setval(pg_get_serial_sequence('"${t}"', 'id'), greatest((select max(id) from "${t}"), 1))`);
    }

    // 6. Verifikasi di dalam transaksi (SPEC §8.4).
    const jumlahSama: Record<string, boolean> = {};
    for (const [t, hh] of Object.entries(laporan.tabel)) {
      const r = await c.query<{ n: number }>(`select count(*)::int as n from "${t}"`);
      jumlahSama[t] = r.rows[0]!.n >= hh.sumber - hh.dilewati;
    }
    const token = await c.query<{ id: number; qr_token: string }>("select id, qr_token from assets");
    const tokenTujuan = new Map(token.rows.map((r) => [r.id, r.qr_token]));
    laporan.verifikasi = { tokenSama: src.assets.every((a) => tokenTujuan.get(Number(a.id)) === a.qr_token), jumlahSama };

    if (laporan.audit.diLuarEnum.length) {
      throw new Error(`Ada ${laporan.audit.diLuarEnum.length} nilai di luar enum v2; putuskan pemetaannya dulu (lihat audit.diLuarEnum).`);
    }
    if (!laporan.verifikasi.tokenSama) throw new Error("Token QR hasil migrasi tidak sama persis dengan sumber.");

    if (opts.jalankan) {
      await c.query("commit");
      log("Transaksi disimpan.");
    } else {
      await c.query("rollback");
      log("Dry-run: transaksi dibatalkan, tidak ada yang ditulis dan tidak ada foto yang diunggah.");
    }
    laporan.selesai = true;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    laporan.galat = e instanceof Error ? e.message : String(e);
  } finally {
    c.release();
    await pool.end();
  }
  return laporan;
}

export function cetakLaporan(l: LaporanMigrasi): string {
  const baris = [`Mode: ${l.mode}${l.selesai ? "" : " (GAGAL)"}`, "", "Tabel                 Sumber   Baru  Diperbarui  Dilewati"];
  for (const [t, h] of Object.entries(l.tabel)) {
    baris.push(`${t.padEnd(20)} ${String(h.sumber).padStart(7)} ${String(h.baru).padStart(6)} ${String(h.diperbarui).padStart(11)} ${String(h.dilewati).padStart(9)}`);
  }
  const a = l.audit;
  baris.push(
    "",
    "Audit:",
    `  draf: ${a.draf} (draf ganda dilewati: ${a.drafGandaDilewati.length ? a.drafGandaDilewati.join(", ") : "-"})`,
    `  nilai jawaban > 32 karakter: ${a.nilaiLebih32}`,
    `  inspeksi final tanpa inspected_at: ${a.finalTanpaWaktu.length ? a.finalTanpaWaktu.join(", ") : "-"}`,
    `  baris foto tanpa berkas: ${a.fotoTanpaBerkas.length}${a.fotoTanpaBerkas.length ? ` (${a.fotoTanpaBerkas.slice(0, 5).join(", ")})` : ""}`,
    `  berkas foto tanpa baris: ${a.berkasTanpaBaris.length}${a.berkasTanpaBaris.length ? ` (${a.berkasTanpaBaris.slice(0, 5).join(", ")})` : ""}`,
    `  nilai di luar enum: ${a.diLuarEnum.length ? a.diLuarEnum.join("; ") : "-"}`,
  );
  if (l.verifikasi) {
    const beda = Object.entries(l.verifikasi.jumlahSama).filter(([, ok]) => !ok).map(([t]) => t);
    baris.push("", `Verifikasi: token QR sama persis: ${l.verifikasi.tokenSama ? "ya" : "TIDAK"}; jumlah baris: ${beda.length ? `berbeda di ${beda.join(", ")}` : "sesuai"}`);
  }
  if (l.galat) baris.push("", `GALAT: ${l.galat}`);
  return baris.join("\n");
}

async function main() {
  const { values } = parseArgs({
    options: {
      sqlite: { type: "string" },
      foto: { type: "string" },
      jalankan: { type: "boolean", default: false },
      laporan: { type: "string" },
    },
  });
  if (!values.sqlite || !values.foto) {
    console.error("Pakai: pnpm migrasi --sqlite <berkas.sqlite> --foto <folder berisi inspeksi/> [--jalankan] [--laporan out.json]");
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL belum diatur.");
    process.exit(2);
  }
  const l = await migrasi({ sqlite: values.sqlite, foto: values.foto, jalankan: values.jalankan, databaseUrl, log: console.log });
  console.log(cetakLaporan(l));
  if (values.laporan) await writeFile(values.laporan, JSON.stringify(l, null, 2));
  process.exit(l.selesai ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main();
