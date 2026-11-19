/**
 * Seed modul Kotak P3K dan Hydrant (box, pilar): checklist dari definisi murni
 * (src/lib/domain/modul), aset contoh dari CSV, dan beberapa inspeksi contoh supaya
 * laporan dan dasbor tidak kosong. Idempoten. Aset contoh anonim, koordinat contoh.
 * Tipe aset dan unit pemilik dibuat seed fondasi (tipeObjek); langkah foto oleh seed sesi C.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as s from "../schema";
import { buatTokenQr, labelLantai, tebakLokasiTipe } from "../../lib/domain/asset";
import { DIVISI, type Kesimpulan, type Severity, type TindakanRekomendasi } from "../../lib/domain/constants";
import { periodeDari, jatuhTempo } from "../../lib/domain/inspeksi";
import { DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR } from "../../lib/domain/modul/hydrant";
import { DEFINISI_P3K, bakuIsi, temuanIsiP3k, type JawabanIsiP3k } from "../../lib/domain/modul/p3k";
import { semuaButir, type DefinisiModul } from "../../lib/domain/modul/tipe";
import { hariIniJakarta } from "../../lib/format";

type Db = NodePgDatabase<typeof s>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const MODUL = [DEFINISI_P3K, DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR];

/** Checklist satu modul, dikunci pada (tipe aset, kode grup) dan (grup, urut) seperti checklistApar. */
async function checklistModul(tx: Tx, m: DefinisiModul, assetTypeId: number) {
  for (const [gi, g] of m.grup.entries()) {
    let [group] = await tx
      .select()
      .from(s.checklistGroups)
      .where(and(eq(s.checklistGroups.assetTypeId, assetTypeId), eq(s.checklistGroups.kode, g.kode)));
    if (group) await tx.update(s.checklistGroups).set({ nama: g.nama, urut: gi + 1 }).where(eq(s.checklistGroups.id, group.id));
    else [group] = await tx.insert(s.checklistGroups).values({ assetTypeId, kode: g.kode, nama: g.nama, urut: gi + 1 }).returning();
    for (const b of g.butir) {
      const values = {
        label: b.label,
        answerType: b.answerType,
        options: b.options ?? null,
        severityMap: b.severityMap ?? null,
        severityDefault: b.severityDefault,
        jumlahBaku: null,
        jumlahBakuPerTipe: b.baku ?? null,
        hasExpiry: !!b.adaKedaluwarsa,
        satuan: b.satuan ?? null,
        tindakanBawaan: b.tindakan,
        dasarHukum: b.dasarHukum,
        keterangan: b.keterangan ?? null,
        wajib: true,
        aktif: true,
      };
      const [ada] = await tx
        .select({ id: s.checklistItems.id })
        .from(s.checklistItems)
        .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
        .where(and(eq(s.checklistGroups.assetTypeId, assetTypeId), eq(s.checklistItems.urut, b.urut)));
      if (ada) await tx.update(s.checklistItems).set({ ...values, checklistGroupId: group!.id }).where(eq(s.checklistItems.id, ada.id));
      else await tx.insert(s.checklistItems).values({ ...values, checklistGroupId: group!.id, urut: b.urut });
    }
  }
}

function bacaCsv(nama: string): Record<string, string>[] {
  const [header, ...isi] = readFileSync(join(import.meta.dirname, nama), "utf8")
    .split(/\r?\n/)
    .filter((b) => b.trim() !== "")
    .map((b) => b.split(",").map((x) => x.trim()));
  return isi.map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ""])));
}

/** Aset contoh. Token QR diterbitkan acak saat aset pertama kali dibuat dan tidak diganti seed ulang. */
async function aset(tx: Tx, rows: { assetTypeId: number; divisionId: number; row: Record<string, string>; attributes: Record<string, unknown> }[]) {
  for (const { assetTypeId, divisionId, row, attributes } of rows) {
    const values = {
      assetTypeId,
      divisionId,
      kode: row.kode!,
      gedung: row.gedung!,
      lantai: row.lantai!,
      lokasiTeks: row.lokasi_teks!,
      lokasiTipe: tebakLokasiTipe(row.gedung!),
      lat: Number(row.lat),
      lng: Number(row.lng),
      radiusM: null,
      attributes,
      aktif: true,
    };
    await tx
      .insert(s.assets)
      .values({ ...values, qrToken: buatTokenQr() })
      // Aset yang sudah ada tidak pernah diubah.
      .onConflictDoNothing({ target: [s.assets.assetTypeId, s.assets.kode] });
  }
}

type Butir = typeof s.checklistItems.$inferSelect;

/**
 * Inspeksi contoh bulan berjalan: sebagian kotak P3K dan hydrant sudah diperiksa, ada yang
 * berisi temuan (isi kurang, kedaluwarsa, selang rusak). Dilewati bila modul ini sudah punya inspeksi.
 */
async function contoh(tx: Tx, tipeId: Record<string, number>) {
  const ids = Object.values(tipeId);
  const [{ n }] = (await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(s.inspections)
    .innerJoin(s.assets, eq(s.assets.id, s.inspections.assetId))
    .where(inArray(s.assets.assetTypeId, ids))) as [{ n: number }];
  if (n > 0) {
    console.log("Inspeksi P3K/hydrant sudah ada: contoh dilewati.");
    return;
  }
  const [p3kUser] = await tx.select().from(s.users).where(eq(s.users.nip, "2004"));
  const [demo] = await tx.select().from(s.users).where(eq(s.users.nip, "inspektur"));
  const [pk] = await tx.select().from(s.users).where(eq(s.users.nip, "2001"));
  const hariIni = hariIniJakarta();
  const periode = periodeDari(hariIni);
  const now = Date.now();
  let jumlah = 0;
  let jumlahTemuan = 0;

  const butirTipe = async (id: number): Promise<Butir[]> =>
    (
      await tx
        .select({ i: s.checklistItems })
        .from(s.checklistItems)
        .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
        .where(eq(s.checklistGroups.assetTypeId, id))
        .orderBy(s.checklistItems.urut)
    ).map((r) => r.i);

  async function simpan(
    a: typeof s.assets.$inferSelect,
    userId: number,
    jamLalu: number,
    jawaban: (typeof s.inspectionAnswers.$inferInsert)[],
    temuan: { checklistItemId: number; item: string; severity: Severity; tindakan: TindakanRekomendasi }[],
    rekomendasi: string | null,
  ) {
    const t = new Date(now - jamLalu * 3600_000);
    const kesimpulan: Kesimpulan = temuan.some((x) => x.severity === "berat") ? "tidak_layak" : temuan.length ? "layak_catatan" : "layak";
    const [ins] = await tx
      .insert(s.inspections)
      .values({
        assetId: a.id,
        userId,
        status: "final",
        scannedAtDevice: new Date(t.getTime() - 240_000),
        submittedAtDevice: t,
        receivedAt: t,
        inspectedAt: t,
        mulaiPada: new Date(t.getTime() - 240_000),
        durasiDetik: 240,
        gpsLat: a.lat,
        gpsLng: a.lng,
        gpsAccuracy: 10,
        gpsCapturedAt: t,
        jarakM: 3,
        qrVerified: true,
        qrVerification: "online",
        gateStatus: "sesuai",
        kesimpulan,
        rekomendasi,
      })
      .returning();
    await tx.insert(s.inspectionAnswers).values(jawaban.map((j) => ({ ...j, inspectionId: ins!.id })));
    for (const x of temuan) {
      await tx.insert(s.issues).values({
        assetId: a.id,
        inspectionId: ins!.id,
        checklistItemId: x.checklistItemId,
        item: x.item,
        severity: x.severity,
        lokasi: [a.gedung, labelLantai(a.lantai), a.lokasiTeks].filter(Boolean).join(" · "),
        tindakanRekomendasi: x.tindakan,
      });
    }
    const tanggal = hariIniJakarta(t);
    await tx.update(s.assets).set({ terakhirDicek: tanggal }).where(eq(s.assets.id, a.id));
    await tx
      .insert(s.schedules)
      .values({ assetId: a.id, periode, jatuhTempo: jatuhTempo(periode, 30), inspectionId: ins!.id, status: "selesai" })
      .onConflictDoUpdate({ target: [s.schedules.assetId, s.schedules.periode], set: { inspectionId: ins!.id, status: "selesai" } });
    jumlah++;
    jumlahTemuan += temuan.length;
  }

  // P3K: 4 dari 10 kotak diperiksa; kotak ke-2 isi kurang, kotak ke-3 ada yang kedaluwarsa.
  if (p3kUser) {
    const butir = await butirTipe(tipeId.p3k!);
    const kotak = await tx.select().from(s.assets).where(eq(s.assets.assetTypeId, tipeId.p3k!)).orderBy(s.assets.kode);
    for (const [i, a] of kotak.slice(0, 4).entries()) {
      const tipe = (a.attributes?.tipe_kotak ?? "A") as "A" | "B" | "C";
      const isi: JawabanIsiP3k[] = butir
        .filter((b) => b.jumlahBakuPerTipe)
        .map((b) => ({
          checklistItemId: b.id,
          nilaiAngka: (bakuIsi({ jumlahBaku: b.jumlahBakuPerTipe }, tipe) ?? 0) - (i === 1 && b.urut === 8 ? 4 : 0) - (i === 1 && b.urut === 5 ? 2 : 0),
          kondisiIsi: i === 2 && b.urut === 20 ? "kedaluwarsa" : "aman",
          tglKedaluwarsaTerdekat: b.hasExpiry ? (i === 2 && b.urut === 20 ? hariIniJakarta(new Date(now - 12 * 86400_000)) : i === 3 && b.urut === 21 ? hariIniJakarta(new Date(now + 20 * 86400_000)) : "2027-09-30") : null,
        }));
      const butirIsi = butir
        .filter((b) => b.jumlahBakuPerTipe)
        .map((b) => ({ id: b.id, label: b.label, jumlahBaku: b.jumlahBakuPerTipe, hasExpiry: b.hasExpiry, satuan: b.satuan }));
      const temuan = temuanIsiP3k(butirIsi, isi, { tipeKotak: tipe, hariIni });
      const jawaban = [
        ...butir.filter((b) => !b.jumlahBakuPerTipe).map((b) => ({ inspectionId: "", checklistItemId: b.id, nilai: "ok" })),
        ...isi.map((j) => ({ inspectionId: "", ...j })),
      ];
      await simpan(a, p3kUser.id, 30 + i * 5, jawaban, temuan, temuan.length ? "Lengkapi dan ganti isi kotak dari gudang P3K." : null);
    }
  }

  // Hydrant: 3 box dan 2 pilar diperiksa; HB-02 selang rusak (berat), HP-02 korosi (sedang).
  const petugasPk = demo ?? pk;
  if (petugasPk) {
    for (const [slug, kodeRusak, urutRusak] of [
      ["hydrant_box", "HB-02", 3],
      ["hydrant_pilar", "HP-02", 4],
    ] as const) {
      const butir = await butirTipe(tipeId[slug]!);
      const daftar = await tx.select().from(s.assets).where(eq(s.assets.assetTypeId, tipeId[slug]!)).orderBy(s.assets.kode);
      for (const [i, a] of daftar.slice(0, slug === "hydrant_box" ? 3 : 2).entries()) {
        const rusak = a.kode === kodeRusak;
        const jawaban = butir.map((b) => ({ inspectionId: "", checklistItemId: b.id, nilai: rusak && b.urut === urutRusak ? "Rusak" : "Baik" }));
        const b = butir.find((x) => x.urut === urutRusak)!;
        const temuan = rusak ? [{ checklistItemId: b.id, item: `${b.label}: Rusak`, severity: b.severityMap!.Rusak!, tindakan: b.tindakanBawaan ?? "perbaiki" }] : [];
        await simpan(a, petugasPk.id, 8 + i * 3 + (slug === "hydrant_pilar" ? 1 : 0), jawaban, temuan, rusak ? "Ganti atau perbaiki sebelum periode berikutnya." : null);
      }
    }
  }

  // Jadwal "belum" untuk aset modul ini yang belum diperiksa.
  const semua = await tx.select({ id: s.assets.id }).from(s.assets).where(inArray(s.assets.assetTypeId, ids));
  for (const a of semua) {
    await tx.insert(s.schedules).values({ assetId: a.id, periode, jatuhTempo: jatuhTempo(periode, 30), status: "belum" }).onConflictDoNothing();
  }
  console.log(`Inspeksi contoh P3K/hydrant: ${jumlah}; temuan: ${jumlahTemuan}`);
}

export async function seedP3kHydrant(tx: Tx) {
  const tipe = await tx
    .select({ id: s.assetTypes.id, slug: s.assetTypes.slug })
    .from(s.assetTypes)
    .where(inArray(s.assetTypes.slug, MODUL.map((m) => m.slug)));
  const tipeId = Object.fromEntries(tipe.map((t) => [t.slug, t.id])) as Record<string, number>;
  const div = Object.fromEntries((await tx.select().from(s.divisions)).map((d) => [d.kode, d.id])) as Record<string, number>;
  for (const m of MODUL) {
    if (!tipeId[m.slug]) throw new Error(`Tipe aset ${m.slug} belum ada: jalankan tipeObjek dulu.`);
    await checklistModul(tx, m, tipeId[m.slug]!);
  }
  const p3k = bacaCsv("p3k.csv");
  const hydrant = bacaCsv("hydrant.csv");
  await aset(tx, [
    ...p3k.map((row) => ({ assetTypeId: tipeId.p3k!, divisionId: div[DIVISI.matra]!, row, attributes: { tipe_kotak: row.tipe_kotak } })),
    ...hydrant.map((row) => ({
      assetTypeId: tipeId[row.tipe === "pilar" ? "hydrant_pilar" : "hydrant_box"]!,
      divisionId: div[DIVISI.satPk]!,
      row,
      attributes: {},
    })),
  ]);
  console.log(`Checklist P3K ${semuaButir(DEFINISI_P3K).length}, hydrant box ${semuaButir(DEFINISI_HYDRANT_BOX).length}, pilar ${semuaButir(DEFINISI_HYDRANT_PILAR).length}; aset P3K ${p3k.length}, hydrant ${hydrant.length}`);
  await contoh(tx, tipeId);
}
