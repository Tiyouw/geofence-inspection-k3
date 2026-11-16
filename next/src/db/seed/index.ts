/**
 * Seed data awal, setara database/seeders Laravel (Master, User, Apar, DemoUser),
 * ditambah sedikit contoh inspeksi/temuan/jadwal agar dasbor tidak kosong.
 * Tidak ada data asli PT PAL: nama adalah nama peran, koordinat adalah contoh.
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
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../schema";
import { buatTokenQr, tebakLokasiTipe } from "../../lib/domain/asset";
import { hariIniJakarta } from "../../lib/format";
import { kunciFoto, sha256Hex, simpanFoto } from "../../lib/storage/photos";
import type { AnswerType, Role, Severity } from "../../lib/domain/constants";

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: s, casing: "snake_case" });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const hash = (p: string) => bcrypt.hash(p, 10);

async function divisi(tx: Tx) {
  const data = [
    { nama: "Manajemen Aset/Infrastruktur & K3LH", kode: "K3LH" },
    { nama: "Teknologi Informasi", kode: "TI" },
    { nama: "Gedung PIP", kode: "PIP" },
  ];
  for (const row of data) {
    await tx.insert(s.divisions).values(row).onConflictDoUpdate({ target: s.divisions.kode, set: { nama: row.nama } });
  }
  const rows = await tx.select().from(s.divisions);
  return Object.fromEntries(rows.map((r) => [r.kode, r.id])) as Record<string, number>;
}

/** periode_hari APAR = 30 mengikuti NFPA 10 (inspeksi bulanan). */
async function tipeObjek(tx: Tx) {
  const data = [
    { slug: "apar", nama: "APAR", isMobile: false, periodeHari: 30, urut: 1 },
    { slug: "hydrant", nama: "Hydrant", isMobile: false, periodeHari: 30, urut: 2 },
    { slug: "p3k", nama: "Kotak P3K", isMobile: false, periodeHari: 30, urut: 3 },
    { slug: "damkar", nama: "Mobil Pemadam", isMobile: true, periodeHari: 7, urut: 4 },
  ];
  for (const row of data) {
    await tx.insert(s.assetTypes).values(row).onConflictDoUpdate({ target: s.assetTypes.slug, set: row });
  }
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

/** Checklist APAR 10 butir, turunan Lampiran 03 PT PAL. */
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

/** Sembilan petugas contoh (nama peran, bukan pegawai asli). */
const PETUGAS: [string, string, string, Role, string, string][] = [
  ["1001", "Admin K3", "admin@pal.test", "admin", "Staf Administrasi K3LH", "K3LH"],
  ["1002", "Kepala Seksi K3", "kasi.k3@pal.test", "admin", "Kepala Seksi K3LH", "K3LH"],
  ["2001", "Inspektur Gedung PIP", "inspektur1@pal.test", "inspektur", "Petugas Inspeksi APAR", "PIP"],
  ["2002", "Inspektur Workshop", "inspektur2@pal.test", "inspektur", "Petugas Inspeksi APAR", "PIP"],
  ["2003", "Inspektur Area Luar", "inspektur3@pal.test", "inspektur", "Petugas Inspeksi APAR", "PIP"],
  ["2004", "Inspektur Pengganti", "inspektur4@pal.test", "inspektur", "Petugas Inspeksi APAR", "PIP"],
  ["2005", "Inspektur Shift Malam", "inspektur5@pal.test", "inspektur", "Petugas Inspeksi APAR", "PIP"],
  ["3001", "Pemantau Manajemen", "pemantau@pal.test", "pemantau", "Manajer Infrastruktur", "TI"],
  ["3002", "Pemantau TI", "pemantau.ti@pal.test", "pemantau", "Staf Teknologi Informasi", "TI"],
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
    ["admin", "Administrator Demo", "admin", process.env.DEMO_ADMIN_PASSWORD || "admin123", "K3LH"],
    ["pemantau", "Pemantau Demo", "pemantau", process.env.DEMO_PEMANTAU_PASSWORD || "pemantau123", "TI"],
    ["inspektur", "Inspektur Demo", "inspektur", process.env.DEMO_INSPEKTUR_PASSWORD || "inspektur123", "PIP"],
  ];
  for (const [nip, name, role, password, kodeDivisi] of akun) {
    const values = {
      nip,
      name,
      email: `${nip}@demo.pal.test`,
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
async function apar(tx: Tx, aparId: number, divPip: number) {
  const rows = bacaCsv(readFileSync(join(import.meta.dirname, "apar.csv"), "utf8"));
  for (const row of rows) {
    const values = {
      assetTypeId: aparId,
      divisionId: divPip,
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
  const semuaAset = await tx.select().from(s.assets).orderBy(s.assets.kode);
  const items = await tx
    .select({ id: s.checklistItems.id, answerType: s.checklistItems.answerType, options: s.checklistItems.options, label: s.checklistItems.label })
    .from(s.checklistItems)
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

async function main() {
  await db.transaction(async (tx) => {
    const div = await divisi(tx);
    const aparId = await tipeObjek(tx);
    await checklistApar(tx, aparId);
    await petugas(tx, div);
    await akunDemo(tx, div);
    await apar(tx, aparId, div.PIP!);
    await contohOperasional(tx);
  });
}

main()
  .then(() => console.log("Seed selesai."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
