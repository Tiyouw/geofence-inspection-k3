/**
 * Seed data awal, setara database/seeders Laravel (Master, User, Apar, DemoUser),
 * ditambah sedikit contoh inspeksi/temuan/jadwal agar dasbor tidak kosong.
 * Tidak ada data asli perusahaan: nama adalah nama peran, koordinat adalah contoh.
 *
 * Idempoten: aman dijalankan ulang (upsert pada kunci alami). Sandi akun yang
 * sudah ada tidak ditimpa, kecuali akun demo (supaya sandi demo selalu sesuai env).
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../schema";
import { seedP3kHydrant } from "./modul-p3k-hydrant";
import { DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR } from "../../lib/domain/modul/hydrant";
import { DEFINISI_P3K } from "../../lib/domain/modul/p3k";
import { buatTokenQr, tebakLokasiTipe } from "../../lib/domain/asset";
import { hariIniJakarta } from "../../lib/format";
import { kunciFoto, sha256Hex, simpanFoto } from "../../lib/storage/photos";
import { LANGKAH_FOTO_APAR, validasiDefinisiLangkah, type DefinisiLangkahFoto } from "../../lib/domain/langkah-foto";
import { DIVISI, PEMILIK_TIPE, type AnswerType, type AssetTypeSlug, type Role, type Severity } from "../../lib/domain/constants";
import { seedDamkar } from "./checklist-damkar";
import { LANGKAH_FOTO_DAMKAR, SLUG_DAMKAR } from "../../lib/domain/modul/damkar";

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: s, casing: "snake_case" });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const hash = (p: string) => bcrypt.hash(p, 10);

async function divisi(tx: Tx) {
  // v2: dua unit pemilik modul (PRD "Unit kerja"). Unit contoh v1 dinonaktifkan, tidak dihapus.
  const data = [
    { nama: "SAT. PK", kode: DIVISI.satPk, aktif: true },
    { nama: "Divisi Matra & K3LH", kode: DIVISI.matra, aktif: true },
    { nama: "Manajemen Aset/Infrastruktur & K3LH", kode: "K3LH", aktif: false },
    { nama: "Teknologi Informasi", kode: "TI", aktif: false },
    { nama: "Gedung PIP", kode: "PIP", aktif: false },
  ];
  for (const row of data) {
    await tx
      .insert(s.divisions)
      .values(row)
      .onConflictDoUpdate({ target: s.divisions.kode, set: { nama: row.nama, aktif: row.aktif } });
  }
  const rows = await tx.select().from(s.divisions);
  return Object.fromEntries(rows.map((r) => [r.kode, r.id])) as Record<string, number>;
}

/**
 * Tipe aset v2 dengan unit pemilik. periode_hari APAR = 30 mengikuti NFPA 10 (inspeksi bulanan);
 * mobil pemadam 7 hari. Slug lama `damkar` diganti `mobil_pemadam` (id tetap); `hydrant` dipecah
 * menjadi `hydrant_pilar` dan `hydrant_box`, dan baris lamanya dinonaktifkan (tidak dihapus).
 */
async function tipeObjek(tx: Tx, div: Record<string, number>) {
  const [damkar] = await tx.select().from(s.assetTypes).where(eq(s.assetTypes.slug, "damkar"));
  const [mobil] = await tx.select().from(s.assetTypes).where(eq(s.assetTypes.slug, "mobil_pemadam"));
  if (damkar && !mobil) await tx.update(s.assetTypes).set({ slug: "mobil_pemadam" }).where(eq(s.assetTypes.id, damkar.id));

  const data: { slug: AssetTypeSlug; nama: string; isMobile: boolean; periodeHari: number; urut: number }[] = [
    { slug: "apar", nama: "APAR", isMobile: false, periodeHari: 30, urut: 1 },
    { slug: "hydrant_pilar", nama: "Hydrant Pilar", isMobile: false, periodeHari: 30, urut: 2 },
    { slug: "hydrant_box", nama: "Hydrant Box", isMobile: false, periodeHari: 30, urut: 3 },
    { slug: "p3k", nama: "Kotak P3K", isMobile: false, periodeHari: 30, urut: 4 },
    { slug: "mobil_pemadam", nama: "Mobil Pemadam", isMobile: true, periodeHari: 7, urut: 5 },
  ];
  for (const row of data) {
    const values = { ...row, aktif: true, ownerDivisionId: div[PEMILIK_TIPE[row.slug]]! };
    await tx.insert(s.assetTypes).values(values).onConflictDoUpdate({ target: s.assetTypes.slug, set: values });
  }
  await tx.update(s.assetTypes).set({ aktif: false, urut: 99 }).where(eq(s.assetTypes.slug, "hydrant"));
  const [apar] = await tx.select().from(s.assetTypes).where(eq(s.assetTypes.slug, "apar"));
  return apar!.id;
}

type ItemSeed = {
  label: string;
  answerType: AnswerType;
  options?: string[];
  severityMap?: Record<string, Severity>;
  severityDefault: Severity;
  dasarHukum: string;
  keterangan?: string;
};

/** Checklist APAR 10 butir, turunan formulir APAR perusahaan (Lampiran 03). */
const CHECKLIST_APAR: { kode: string; nama: string; items: ItemSeed[] }[] = [
  {
    kode: "A",
    nama: "Isi & Tekanan",
    items: [
      {
        label: "Volume isi tabung",
        answerType: "select",
        options: ["Penuh", "Tidak penuh"],
        severityMap: { "Tidak penuh": "berat" },
        severityDefault: "berat",
        dasarHukum: "Permenaker 4/1980 Pasal 12(1)a",
        keterangan: "Dipisah dari tekanan karena keduanya hal berbeda dan dapat berbeda hasil.",
      },
      {
        label: "Tekanan manometer",
        answerType: "select",
        options: ["Zona hijau", "Kurang", "Berlebih", "Tanpa manometer"],
        severityMap: { Kurang: "berat", Berlebih: "berat" },
        severityDefault: "berat",
        dasarHukum: "Permenaker 4/1980 Pasal 12(1)a",
      },
      { label: "Segel dan mekanik penembus", answerType: "boolean", severityDefault: "sedang", dasarHukum: "Permenaker 4/1980 Pasal 12(1)a" },
    ],
  },
  {
    kode: "B",
    nama: "Kondisi Fisik",
    items: [
      {
        label: "Badan tabung",
        answerType: "select",
        options: ["Mulus", "Berkarat ringan", "Berkarat berat", "Penyok", "Harus diganti"],
        severityMap: { "Berkarat ringan": "ringan", "Berkarat berat": "sedang", Penyok: "sedang", "Harus diganti": "berat" },
        severityDefault: "sedang",
        dasarHukum: "Permenaker 4/1980 Pasal 12(1)b",
      },
      { label: "Handle dan tuas", answerType: "boolean", severityDefault: "sedang", dasarHukum: "Permenaker 4/1980 Pasal 12(1)b" },
      { label: "Label dan petunjuk pakai", answerType: "boolean", severityDefault: "ringan", dasarHukum: "Permenaker 4/1980 Pasal 12(1)b" },
    ],
  },
  {
    kode: "C",
    nama: "Saluran Pancar",
    items: [
      { label: "Mulut pancar tidak tersumbat", answerType: "boolean", severityDefault: "berat", dasarHukum: "Permenaker 4/1980 Pasal 12(1)c" },
      { label: "Pipa atau selang pancar tidak retak", answerType: "boolean", severityDefault: "sedang", dasarHukum: "Permenaker 4/1980 Pasal 12(1)c" },
    ],
  },
  {
    kode: "D",
    nama: "Penempatan",
    items: [
      {
        label: "Keterjangkauan dan ketinggian",
        answerType: "boolean",
        severityDefault: "ringan",
        dasarHukum: "Permenaker 4/1980 Pasal 4-8 (tinggi 120 cm, jarak antar-APAR maks 15 m)",
      },
      { label: "Tanda pemasangan dan kartu kontrol", answerType: "boolean", severityDefault: "ringan", dasarHukum: "Permenaker 4/1980 Pasal 4(1); NFPA 10" },
    ],
  },
];

async function checklistApar(tx: Tx, aparId: number) {
  let urut = 0;
  for (const [gi, g] of CHECKLIST_APAR.entries()) {
    let [group] = await tx
      .select()
      .from(s.checklistGroups)
      .where(and(eq(s.checklistGroups.assetTypeId, aparId), eq(s.checklistGroups.kode, g.kode)));
    if (group) {
      await tx.update(s.checklistGroups).set({ nama: g.nama, urut: gi + 1 }).where(eq(s.checklistGroups.id, group.id));
    } else {
      [group] = await tx.insert(s.checklistGroups).values({ assetTypeId: aparId, kode: g.kode, nama: g.nama, urut: gi + 1 }).returning();
    }
    for (const item of g.items) {
      urut++;
      // Dikunci pada (grup, urut), bukan label: label bisa direvisi, urut mengikuti Lampiran 03.
      const values = {
        label: item.label,
        answerType: item.answerType,
        options: item.options ?? null,
        severityMap: item.severityMap ?? null,
        severityDefault: item.severityDefault,
        dasarHukum: item.dasarHukum,
        keterangan: item.keterangan ?? null,
        wajib: true,
        aktif: true,
      };
      const [ada] = await tx
        .select({ id: s.checklistItems.id })
        .from(s.checklistItems)
        .where(and(eq(s.checklistItems.checklistGroupId, group!.id), eq(s.checklistItems.urut, urut)));
      if (ada) await tx.update(s.checklistItems).set(values).where(eq(s.checklistItems.id, ada.id));
      else await tx.insert(s.checklistItems).values({ ...values, checklistGroupId: group!.id, urut });
    }
  }
}

/**
 * Sembilan petugas contoh (nama peran, bukan pegawai asli). Inspektur wajib punya unit:
 * SAT. PK (APAR, hydrant, mobil pemadam) atau Divisi Matra & K3LH (kotak P3K).
 */
const PETUGAS: [string, string, string, Role, string, string][] = [
  ["1001", "Admin K3", "admin@contoh.test", "admin", "Staf Administrasi K3", DIVISI.matra],
  ["1002", "Kepala Seksi K3", "kasi.k3@contoh.test", "admin", "Kepala Seksi K3", DIVISI.matra],
  ["2001", "Inspektur Gedung Kantor", "inspektur1@contoh.test", "inspektur", "Petugas SAT. PK", DIVISI.satPk],
  ["2002", "Inspektur Bengkel", "inspektur2@contoh.test", "inspektur", "Petugas SAT. PK", DIVISI.satPk],
  ["2003", "Inspektur Area Luar", "inspektur3@contoh.test", "inspektur", "Petugas SAT. PK", DIVISI.satPk],
  ["2004", "Inspektur P3K", "inspektur4@contoh.test", "inspektur", "Petugas Matra & K3LH", DIVISI.matra],
  ["2005", "Inspektur P3K Pengganti", "inspektur5@contoh.test", "inspektur", "Petugas Matra & K3LH", DIVISI.matra],
  ["3001", "Pemantau Manajemen", "pemantau@contoh.test", "pemantau", "Pejabat Pengawas", DIVISI.matra],
  ["3002", "Pemantau SAT. PK", "pemantau.pk@contoh.test", "pemantau", "Kepala SAT. PK", DIVISI.satPk],
];

async function petugas(tx: Tx, div: Record<string, number>) {
  const dariEnv = (process.env.SEED_SANDI_AWAL ?? "") !== "";
  const sandi = dariEnv ? process.env.SEED_SANDI_AWAL! : Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
  const passwordHash = await hash(sandi);
  let baru = 0;
  for (const [nip, name, email, role, jabatan, kodeDivisi] of PETUGAS) {
    const r = await tx
      .insert(s.users)
      .values({ nip, name, email, role, jabatan, divisionId: div[kodeDivisi], passwordHash })
      .onConflictDoUpdate({ target: s.users.nip, set: { name, email, role, jabatan, divisionId: div[kodeDivisi] } })
      .returning({ baru: sql<boolean>`xmax = 0` });
    if (r[0]?.baru) baru++;
  }
  console.log(`Petugas contoh: ${PETUGAS.length} (akun baru: ${baru})`);
  // Sandi acak hanya ada di memori proses ini: tampilkan sekarang atau hilang.
  if (baru > 0 && !dariEnv) console.warn(`Sandi awal akun petugas baru: ${sandi}  (tidak disimpan di mana pun)`);
}

async function akunDemo(tx: Tx, div: Record<string, number>) {
  if (process.env.DEMO_MODE !== "true") {
    console.log("DEMO_MODE bukan true: akun demo dilewati.");
    return;
  }
  const akun: [string, string, Role, string, string][] = [
    ["admin", "Administrator Demo", "admin", process.env.DEMO_ADMIN_PASSWORD || "admin123", DIVISI.matra],
    ["pemantau", "Pemantau Demo", "pemantau", process.env.DEMO_PEMANTAU_PASSWORD || "pemantau123", DIVISI.matra],
    ["inspektur", "Inspektur Demo", "inspektur", process.env.DEMO_INSPEKTUR_PASSWORD || "inspektur123", DIVISI.satPk],
  ];
  for (const [nip, name, role, password, kodeDivisi] of akun) {
    const values = {
      nip,
      name,
      email: `${nip}@demo.contoh.test`,
      role,
      jabatan: "Akun demonstrasi",
      isDemo: true,
      divisionId: div[kodeDivisi],
      aktif: true,
      passwordHash: await hash(password),
    };
    await tx.insert(s.users).values(values).onConflictDoUpdate({ target: s.users.nip, set: values });
  }
  console.log("Tiga akun demo siap: admin, pemantau, inspektur.");
}

/** Pembaca CSV kecil: koma pemisah, tanda kutip ganda untuk nilai berkoma ("4,5"). */
function bacaCsv(teks: string): Record<string, string>[] {
  const baris = teks.replace(/^﻿/, "").split(/\r?\n/).filter((b) => b.trim() !== "");
  const pecah = (b: string) => {
    const out: string[] = [];
    let cur = "";
    let kutip = false;
    for (const ch of b) {
      if (ch === '"') kutip = !kutip;
      else if (ch === "," && !kutip) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const [header, ...isi] = baris.map(pecah);
  return isi.map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ""])));
}

/**
 * 35 APAR contoh dari CSV. Token QR TIDAK ada di CSV: diterbitkan acak saat aset
 * pertama kali dibuat, dan seed ulang tidak menggantinya (stiker tetap berlaku).
 */
async function apar(tx: Tx, aparId: number, divSatPk: number) {
  const rows = bacaCsv(readFileSync(join(import.meta.dirname, "apar.csv"), "utf8"));
  for (const row of rows) {
    const values = {
      assetTypeId: aparId,
      divisionId: divSatPk,
      kode: row.kode!,
      gedung: row.gedung!,
      lantai: row.lantai!,
      lokasiTeks: row.lokasi_teks!,
      lokasiTipe: tebakLokasiTipe(row.gedung!),
      lat: Number(row.lat),
      lng: Number(row.lng),
      // radius di CSV sama dengan radius jenis lokasinya: biarkan kosong (ikut kebijakan).
      radiusM: null,
      attributes: { tipe: row.tipe, kapasitas_kg: Number(row.kapasitas_kg!.replace(",", ".")) },
      aktif: true,
    };
    await tx
      .insert(s.assets)
      .values({ ...values, qrToken: buatTokenQr() })
      .onConflictDoUpdate({ target: [s.assets.assetTypeId, s.assets.kode], set: values });
  }
  console.log(`APAR contoh: ${rows.length}`);
}

/** jatuh_tempo = min(periode + periode_hari - 1, akhir bulan) (SPEC §9 #19). */
function jatuhTempo(periode: string, periodeHari: number): string {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periode.slice(0, 8)}${String(Math.min(periodeHari, akhir)).padStart(2, "0")}`;
}

/**
 * Jadwal bulan berjalan untuk semua APAR, dan beberapa inspeksi contoh oleh akun
 * inspektur demo (atau 2001). Dilewati bila sudah ada inspeksi.
 */
async function contohOperasional(tx: Tx) {
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.inspections);
  if (n > 0) {
    console.log("Inspeksi sudah ada: contoh operasional dilewati.");
    return;
  }
  const [petugasDemo] = await tx.select().from(s.users).where(eq(s.users.nip, "inspektur"));
  const [petugasContoh] = await tx.select().from(s.users).where(eq(s.users.nip, "2001"));
  const userId = (petugasDemo ?? petugasContoh)!.id;
  // Contoh hanya untuk APAR: modul lain punya checklist sendiri.
  const [tipeApar] = await tx.select().from(s.assetTypes).where(eq(s.assetTypes.slug, "apar"));
  const semuaAset = await tx.select().from(s.assets).where(eq(s.assets.assetTypeId, tipeApar!.id)).orderBy(s.assets.kode);
  const items = await tx
    .select({ id: s.checklistItems.id, answerType: s.checklistItems.answerType, options: s.checklistItems.options, label: s.checklistItems.label })
    .from(s.checklistItems)
    .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
    .where(eq(s.checklistGroups.assetTypeId, tipeApar!.id))
    .orderBy(s.checklistItems.urut);

  const contohFoto = new Uint8Array(readFileSync(join(import.meta.dirname, "../../../public/icons/icon-192.png")));
  const periode = hariIniJakarta().slice(0, 8) + "01";
  const tempo = jatuhTempo(periode, 30);
  const now = new Date();

  // Enam aset pertama sudah diperiksa; aset ke-3 punya temuan berat, ke-5 jauh dari titik.
  for (const [i, aset] of semuaAset.slice(0, 6).entries()) {
    const t = new Date(now.getTime() - (6 - i) * 3600_000);
    const temuan = i === 2;
    const [ins] = await tx
      .insert(s.inspections)
      .values({
        assetId: aset.id,
        userId,
        status: "final",
        scannedAtDevice: new Date(t.getTime() - 180_000),
        submittedAtDevice: t,
        receivedAt: t,
        inspectedAt: t,
        mulaiPada: new Date(t.getTime() - 180_000),
        durasiDetik: 180,
        gpsLat: aset.lat,
        gpsLng: aset.lng,
        gpsAccuracy: 12,
        gpsCapturedAt: t,
        jarakM: i === 4 ? 190 : 4,
        qrVerified: true,
        qrVerification: "online",
        gateStatus: i === 4 ? "jauh" : "sesuai",
        kesimpulan: temuan ? "tidak_layak" : "layak",
        catatan: temuan ? "Jarum manometer di zona merah." : null,
        rekomendasi: temuan ? "Isi ulang tabung, pasang unit cadangan." : null,
      })
      .returning();
    await tx.insert(s.inspectionAnswers).values(
      items.map((it) => ({
        inspectionId: ins!.id,
        checklistItemId: it.id,
        nilai:
          it.answerType === "select"
            ? temuan && it.label === "Tekanan manometer"
              ? "Kurang"
              : it.options![0]
            : "ok",
      })),
    );
    // Satu foto contoh per inspeksi (gambar ikon, bukan foto asli), disimpan privat.
    const fotoId = crypto.randomUUID();
    const key = kunciFoto(ins!.id, fotoId, "png");
    await simpanFoto(key, contohFoto, "image/png");
    await tx.insert(s.inspectionPhotos).values({
      id: fotoId,
      inspectionId: ins!.id,
      storageKey: key,
      sha256: sha256Hex(contohFoto),
      contentType: "image/png",
      bytes: contohFoto.byteLength,
      width: 192,
      height: 192,
      takenAtDevice: t,
      lat: aset.lat,
      lng: aset.lng,
    });
    if (temuan) {
      const item = items.find((it) => it.label === "Tekanan manometer")!;
      const [issue] = await tx
        .insert(s.issues)
        .values({
          assetId: aset.id,
          inspectionId: ins!.id,
          checklistItemId: item.id,
          item: "Tekanan manometer: Kurang",
          severity: "berat",
          status: "proses",
          targetSelesai: hariIniJakarta(new Date(t.getTime() + 3 * 86400_000)),
        })
        .returning();
      await tx.insert(s.issueEvents).values({
        issueId: issue!.id,
        aksi: "status",
        dari: { status: "terbuka" },
        ke: { status: "proses", catatan: "Tabung diturunkan, diajukan isi ulang ke vendor." },
      });
    }
    await tx.update(s.assets).set({ terakhirDicek: hariIniJakarta(t) }).where(eq(s.assets.id, aset.id));
    await tx
      .insert(s.schedules)
      .values({ assetId: aset.id, periode, jatuhTempo: tempo, inspectionId: ins!.id, status: "selesai" })
      .onConflictDoNothing();
  }
  for (const aset of semuaAset.slice(6)) {
    await tx.insert(s.schedules).values({ assetId: aset.id, periode, jatuhTempo: tempo, status: "belum" }).onConflictDoNothing();
  }
  console.log(`Jadwal ${periode}: ${semuaAset.length}; inspeksi contoh: 6; temuan contoh: 1`);
}

/**
 * Tech Spec migrasi 1: satu area (tanpa poligon) untuk tiap nilai `assets.gedung`, di bawah satu
 * kawasan galangan, lalu `assets.area_id` diisi. Poligon digambar/diimpor admin kemudian.
 * Aset yang sudah punya area tidak diubah.
 */
async function areaDariGedung(tx: Tx) {
  const [kawasan] = await tx
    .insert(s.areas)
    .values({ kode: "KAWASAN", nama: "Kawasan Galangan", jenis: "kawasan" })
    .onConflictDoUpdate({ target: s.areas.kode, set: { jenis: "kawasan" } })
    .returning();
  const gedung = await tx
    .selectDistinct({ gedung: s.assets.gedung })
    .from(s.assets)
    .where(and(isNull(s.assets.areaId), isNotNull(s.assets.gedung)));
  for (const { gedung: nama } of gedung) {
    const kode = kodeArea(nama!);
    const [area] = await tx
      .insert(s.areas)
      .values({ kode, nama: nama!, jenis: tebakLokasiTipe(nama!) === "bengkel" ? "bengkel" : "gedung", parentId: kawasan!.id })
      .onConflictDoUpdate({ target: s.areas.kode, set: { nama: nama! } })
      .returning();
    await tx
      .update(s.assets)
      .set({ areaId: area!.id })
      .where(and(eq(s.assets.gedung, nama!), isNull(s.assets.areaId)));
  }
  console.log(`Area dari gedung: ${gedung.length}`);
}

/** Kode area dari nama gedung: huruf besar, non-alfanumerik jadi "-", maks 32. */
function kodeArea(nama: string): string {
  return nama.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "AREA";
}

/**
 * Kamera terpandu (ADR-8): tulis langkah foto modul ke `photo_steps` / `photo_step_items`.
 * Idempoten, kunci (tipe aset, kode). `urut` mengikuti urutan larik; `butir` = urut butir
 * checklist tipe aset itu. Langkah yang tidak ada lagi di definisi dinonaktifkan, bukan dihapus
 * (foto lama tetap menunjuk langkahnya).
 */
export async function seedLangkahFoto(tx: Tx, assetTypeId: number, def: DefinisiLangkahFoto[]) {
  const butir = await tx
    .select({ id: s.checklistItems.id, urut: s.checklistItems.urut })
    .from(s.checklistItems)
    .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
    .where(eq(s.checklistGroups.assetTypeId, assetTypeId));
  const galat = validasiDefinisiLangkah(def, butir.map((b) => b.urut));
  if (galat.length) throw new Error(`Langkah foto tipe ${assetTypeId} tidak sah: ${galat.join(" ")}`);
  const idDariUrut = new Map(butir.map((b) => [b.urut, b.id]));

  // Geser urut lama dulu supaya urutan baru tidak bentrok dengan indeks unik (tipe, urut).
  await tx
    .update(s.photoSteps)
    .set({ urut: sql`-${s.photoSteps.id}` })
    .where(eq(s.photoSteps.assetTypeId, assetTypeId));
  for (const [i, l] of def.entries()) {
    const nilai = { urut: i + 1, judul: l.judul, petunjuk: l.petunjuk ?? null, aktif: true };
    const [langkah] = await tx
      .insert(s.photoSteps)
      .values({ assetTypeId, kode: l.kode, ...nilai })
      .onConflictDoUpdate({ target: [s.photoSteps.assetTypeId, s.photoSteps.kode], set: nilai })
      .returning({ id: s.photoSteps.id });
    await tx.delete(s.photoStepItems).where(eq(s.photoStepItems.stepId, langkah!.id));
    await tx.insert(s.photoStepItems).values(l.butir.map((u) => ({ stepId: langkah!.id, checklistItemId: idDariUrut.get(u)! })));
  }
  await tx
    .update(s.photoSteps)
    .set({ aktif: false })
    .where(and(eq(s.photoSteps.assetTypeId, assetTypeId), sql`${s.photoSteps.urut} < 0`));
}

/**
 * DEMO saja: poligon SINTETIS berupa kotak di sekitar titik contoh aset, supaya gerbang lokasi
 * dapat dicoba sebelum denah asli diimpor. Bukan denah perusahaan (denah asli rahasia, ADR-10).
 * Hanya mengisi area yang belum punya poligon maupun draf; poligon asli tidak pernah ditimpa.
 */
async function poligonContoh(tx: Tx) {
  if (process.env.DEMO_MODE !== "true") return;
  const M = 111_195;
  const kotak = (titik: { lat: number; lng: number }[], margin: number): s.GeoJsonPolygon => {
    const lat0 = Math.min(...titik.map((t) => t.lat));
    const lat1 = Math.max(...titik.map((t) => t.lat));
    const lng0 = Math.min(...titik.map((t) => t.lng));
    const lng1 = Math.max(...titik.map((t) => t.lng));
    const dLat = margin / M;
    const dLng = margin / (M * Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180));
    const r = (n: number) => Math.round(n * 1e7) / 1e7;
    const [s0, n0, w0, e0] = [r(lat0 - dLat), r(lat1 + dLat), r(lng0 - dLng), r(lng1 + dLng)];
    return { type: "Polygon", coordinates: [[[w0, s0], [e0, s0], [e0, n0], [w0, n0], [w0, s0]]] };
  };
  const titik = await tx
    .select({ areaId: s.assets.areaId, lat: s.assets.lat, lng: s.assets.lng })
    .from(s.assets)
    .where(and(isNotNull(s.assets.lat), isNotNull(s.assets.lng)));
  const semua = titik.map((t) => ({ areaId: t.areaId, lat: Number(t.lat), lng: Number(t.lng) }));
  if (!semua.length) return;
  const kosong = await tx
    .select({ id: s.areas.id, jenis: s.areas.jenis })
    .from(s.areas)
    .where(and(eq(s.areas.aktif, true), isNull(s.areas.polygon), isNull(s.areas.polygonDraf)));
  let n = 0;
  for (const a of kosong) {
    const milik = a.jenis === "kawasan" ? semua : semua.filter((t) => t.areaId === a.id);
    if (!milik.length) continue;
    await tx
      .update(s.areas)
      .set({ polygon: kotak(milik, a.jenis === "kawasan" ? 300 : 15), poligonDisetujuiPada: new Date() })
      .where(eq(s.areas.id, a.id));
    n++;
  }
  console.log(`Poligon contoh (sintetis): ${n}`);
}

async function main() {
  await db.transaction(async (tx) => {
    const div = await divisi(tx);
    const aparId = await tipeObjek(tx, div);
    await checklistApar(tx, aparId);
    await seedLangkahFoto(tx, aparId, LANGKAH_FOTO_APAR);
    await petugas(tx, div);
    await akunDemo(tx, div);
    await apar(tx, aparId, div[DIVISI.satPk]!);
    await areaDariGedung(tx);
    await seedDamkar(tx, div[DIVISI.satPk] ?? null);
    const [damkar] = await tx.select({ id: s.assetTypes.id }).from(s.assetTypes).where(eq(s.assetTypes.slug, SLUG_DAMKAR));
    if (damkar) await seedLangkahFoto(tx, damkar.id, LANGKAH_FOTO_DAMKAR);
    await contohOperasional(tx);
    // Setelah contohOperasional: contoh APAR membaca semua butir tanpa saring tipe.
    await seedP3kHydrant(tx);
    for (const m of [DEFINISI_P3K, DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR]) {
      const [t] = await tx.select({ id: s.assetTypes.id }).from(s.assetTypes).where(eq(s.assetTypes.slug, m.slug));
      if (t) await seedLangkahFoto(tx, t.id, m.langkahFoto);
    }
    await areaDariGedung(tx);
    // Terakhir: kotak sintetis harus memuat titik semua modul (APAR, P3K, hydrant).
    await poligonContoh(tx);
  });
}

main()
  .then(() => console.log("Seed selesai."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
