import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  areas,
  assets,
  assetTypes,
  auditLogs,
  checklistGroups,
  checklistItems,
  divisions,
  inspectionAnswers,
  inspectionPhotos,
  inspections,
  issues,
  schedules,
} from "@/db/schema";
import { bolehInspeksiAset, pesanAsetUnitLain } from "@/lib/domain/akses";
import { evaluasiGerbang, jarakMeter, radiusEfektif } from "@/lib/domain/asset";
import { KESIMPULAN, KONDISI_ISI, MAKS_BYTE_FOTO, MAKS_FOTO, TINDAKAN_REKOMENDASI, type GateStatus, type Kesimpulan } from "@/lib/domain/constants";
import { konteksP3k } from "@/lib/domain/modul/p3k";
import { maksFotoInspeksi, periksaFotoLangkah } from "@/lib/domain/langkah-foto";
import { bangunTemuan, periksaKirim, waktuResmi, type ButirChecklist, type Temuan } from "@/lib/domain/inspeksi";
import { jatuhTempoUntuk, periodeUntuk } from "@/lib/domain/jadwal";
import { identitasDamkar, type AtributDamkar } from "@/lib/domain/modul/damkar";
import { lokasiTemuan } from "@/lib/domain/temuan";
import { hariIniJakarta } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/guards";
import { hapusFoto, kunciFoto, sha256Hex, simpanFoto } from "@/lib/storage/photos";
import { GalatApi } from "./http";
import { langkahTipeAset } from "./langkah";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SUDAH_DIKIRIM = () => new GalatApi(422, "sudah_final", "Inspeksi sudah dikirim.");

async function drafMilik(tx: Tx | typeof db, user: SessionUser, inspectionId: string, kunci = false) {
  const q = tx.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  const [row] = kunci ? await q.for("update") : await q;
  if (!row) return null;
  if (row.userId !== user.id) throw new GalatApi(403, "bukan_milik", "Inspeksi ini bukan milik Anda.");
  return row;
}

/* ---------- start ---------- */

export const startSchema = z.object({
  inspectionId: z.uuid(),
  token: z.string().min(1).max(64),
  scannedAtDevice: z.iso.datetime({ offset: true }).optional(),
  qrVerification: z.enum(["online", "offline_cache"]).default("online"),
  assetId: z.number().int().positive().optional(),
});

/**
 * Otorisasi unit (PRD F2, ADR-5): inspektur hanya menginspeksi aset yang tipenya dimiliki
 * unit kerjanya. Ditolak 403 dengan pesan yang menyebut unit pemilik.
 */
async function pastikanAsetUnit(tx: Tx, user: SessionUser, assetTypeId: number) {
  const [tipe] = await tx
    .select({ owner: assetTypes.ownerDivisionId, unit: divisions.nama })
    .from(assetTypes)
    .leftJoin(divisions, eq(divisions.id, assetTypes.ownerDivisionId))
    .where(eq(assetTypes.id, assetTypeId));
  if (bolehInspeksiAset(user, tipe?.owner ?? null)) return;
  const [unitSendiri] = user.divisionId
    ? await tx.select({ nama: divisions.nama }).from(divisions).where(eq(divisions.id, user.divisionId))
    : [];
  throw new GalatApi(403, "aset_unit_lain", pesanAsetUnitLain(tipe?.unit ?? null, unitSendiri?.nama ?? null));
}

/**
 * SPEC §3.2 dan §7.3: membuat draf di peladen dengan id dari perangkat.
 * Idempoten per inspectionId. Draf peladen lama milik inspektur yang sama untuk aset
 * yang sama diganti: perangkat adalah sumber kebenaran selama draf (SPEC §7.1).
 */
export async function mulai(user: SessionUser, input: z.infer<typeof startSchema>, ua: string | null) {
  return db.transaction(async (tx) => {
    const ada = await drafMilik(tx, user, input.inspectionId);
    if (ada) return { inspectionId: ada.id, assetId: ada.assetId, status: ada.status };

    const [aset] = await tx.select().from(assets).where(eq(assets.qrToken, input.token)).limit(1);
    if (!aset) {
      throw new GalatApi(410, "token_tidak_dikenal", "Stiker tidak dikenali. Laporkan ke Admin K3.");
    }
    await pastikanAsetUnit(tx, user, aset.assetTypeId);
    if (input.assetId && input.assetId !== aset.id) {
      throw new GalatApi(409, "aset_berbeda", "Stiker tidak cocok dengan aset di perangkat. Perbarui data stiker.");
    }
    // Draf luring tetap diterima walau aset dinonaktifkan sesudahnya (SPEC §7.8).
    if (!aset.aktif && input.qrVerification === "online") {
      throw new GalatApi(409, "aset_nonaktif", "Aset tidak aktif. Hubungi Admin K3.");
    }

    const lama = await tx
      .select({ id: inspections.id })
      .from(inspections)
      .where(and(eq(inspections.assetId, aset.id), eq(inspections.userId, user.id), eq(inspections.status, "draf")));
    for (const l of lama) await buangDraf(tx, l.id);

    const scanned = input.scannedAtDevice ? new Date(input.scannedAtDevice) : null;
    await tx.insert(inspections).values({
      id: input.inspectionId,
      assetId: aset.id,
      userId: user.id,
      status: "draf",
      scannedAtDevice: scanned,
      mulaiPada: new Date(),
      qrVerified: true,
      qrVerification: input.qrVerification,
      ua: ua?.slice(0, 255) ?? null,
    });
    return { inspectionId: input.inspectionId, assetId: aset.id, status: "draf" as const };
  });
}

/* ---------- foto ---------- */

/** Tipe aset dan tanda area terbatas (`areas.restricted`) sebuah aset. */
async function asetUntukFoto(q: Tx | typeof db, assetId: number) {
  const [row] = await q
    .select({ assetTypeId: assets.assetTypeId, terbatas: areas.restricted })
    .from(assets)
    .leftJoin(areas, eq(areas.id, assets.areaId))
    .where(eq(assets.id, assetId));
  return { assetTypeId: row!.assetTypeId, terbatas: row!.terbatas === true };
}

const TIPE_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function unggahFoto(
  user: SessionUser,
  inspectionId: string,
  photoId: string,
  body: Uint8Array,
  meta: {
    contentType: string;
    sha256: string | null;
    takenAt: string | null;
    lat: number | null;
    lng: number | null;
    akurasi: number | null;
    langkah: string | null;
    width: number | null;
    height: number | null;
  },
) {
  const ext = TIPE_FOTO[meta.contentType];
  if (!ext) {
    throw new GalatApi(422, "format_foto", `Format foto tidak didukung (${meta.contentType}). Gunakan kamera bawaan, bukan berkas HEIC.`);
  }
  if (body.byteLength === 0 || body.byteLength > MAKS_BYTE_FOTO) throw new GalatApi(422, "ukuran_foto", "Ukuran foto tidak sah.");
  const sha = sha256Hex(body);
  if (meta.sha256 && meta.sha256.toLowerCase() !== sha) {
    throw new GalatApi(422, "hash_foto", "Foto rusak saat dikirim (hash tidak cocok). Ambil ulang foto.");
  }

  const ins = await drafMilik(db, user, inspectionId);
  if (!ins) throw new GalatApi(409, "draf_tidak_ada", "Draf belum ada di peladen.");

  const [sudah] = await db.select().from(inspectionPhotos).where(eq(inspectionPhotos.id, photoId)).limit(1);
  if (sudah) {
    if (sudah.inspectionId !== inspectionId) throw new GalatApi(409, "foto_bentrok", "Id foto sudah dipakai.");
    return { photoId, sha256: sudah.sha256 };
  }
  if (ins.status === "final") throw SUDAH_DIKIRIM();

  // Kamera terpandu (PRD Aturan bukti 3-4): langkah harus milik tipe aset; area terbatas tanpa foto.
  const { assetTypeId, terbatas } = await asetUntukFoto(db, ins.assetId);
  if (terbatas) throw new GalatApi(422, "area_terbatas", "Aset di area terbatas tidak boleh difoto.");
  const langkah = await langkahTipeAset(db, assetTypeId);
  const langkahFoto = meta.langkah ? langkah.find((l) => l.kode === meta.langkah) : undefined;
  if (meta.langkah && !langkahFoto) {
    throw new GalatApi(422, "langkah_tidak_dikenal", "Langkah foto tidak dikenal. Perbarui data lalu ulangi kamera terpandu.");
  }
  const maks = Math.max(MAKS_FOTO, maksFotoInspeksi(langkah));
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.inspectionId, inspectionId))) as [{ n: number }];
  if (n >= maks) throw new GalatApi(422, "foto_maks", `Foto paling banyak ${maks}.`);

  const key = kunciFoto(inspectionId, photoId, ext);
  await simpanFoto(key, body, meta.contentType);
  await db
    .insert(inspectionPhotos)
    .values({
      id: photoId,
      inspectionId,
      storageKey: key,
      sha256: sha,
      contentType: meta.contentType,
      bytes: body.byteLength,
      width: meta.width,
      height: meta.height,
      takenAtDevice: meta.takenAt ? new Date(meta.takenAt) : null,
      lat: meta.lat,
      lng: meta.lng,
      gpsAccuracy: meta.akurasi === null ? null : Math.min(32767, Math.round(meta.akurasi)),
      stepId: langkahFoto?.id ?? null,
    })
    .onConflictDoNothing();
  return { photoId, sha256: sha };
}

export async function hapusFotoDraf(user: SessionUser, inspectionId: string, photoId: string) {
  const ins = await drafMilik(db, user, inspectionId);
  if (!ins) return { dihapus: false };
  if (ins.status === "final") throw SUDAH_DIKIRIM();
  const [foto] = await db
    .delete(inspectionPhotos)
    .where(and(eq(inspectionPhotos.id, photoId), eq(inspectionPhotos.inspectionId, inspectionId)))
    .returning();
  if (foto) await hapusFoto(foto.storageKey);
  return { dihapus: !!foto };
}

/* ---------- buang draf ---------- */

async function buangDraf(tx: Tx, inspectionId: string) {
  const fotos = await tx.delete(inspectionPhotos).where(eq(inspectionPhotos.inspectionId, inspectionId)).returning();
  await tx.delete(inspections).where(eq(inspections.id, inspectionId));
  for (const f of fotos) await hapusFoto(f.storageKey).catch(() => {});
}

/** SPEC §3.2: draf dapat dibuang beserta foto dan jawaban; inspeksi final tidak. */
export async function buang(user: SessionUser, inspectionId: string) {
  return db.transaction(async (tx) => {
    const ins = await drafMilik(tx, user, inspectionId, true);
    if (!ins) return { dibuang: false };
    if (ins.status === "final") throw new GalatApi(403, "final_tidak_bisa_dibuang", "Inspeksi yang sudah dikirim tidak bisa dibuang.");
    await buangDraf(tx, inspectionId);
    return { dibuang: true };
  });
}

/* ---------- finalisasi ---------- */

export const finalizeSchema = z.object({
  assetId: z.number().int().positive(),
  token: z.string().min(1).max(64),
  qrVerification: z.enum(["online", "offline_cache"]).default("online"),
  scannedAtDevice: z.iso.datetime({ offset: true }).nullish(),
  submittedAtDevice: z.iso.datetime({ offset: true }),
  monoDurationMs: z.number().int().nonnegative().nullish(),
  gps: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(100000),
      capturedAt: z.iso.datetime({ offset: true }).nullish(),
    })
    .nullish(),
  answers: z
    .array(
      z.object({
        checklistItemId: z.number().int().positive(),
        nilai: z.string().max(120).nullish(),
        nilaiAngka: z.number().int().nullish(),
        catatan: z.string().max(500).nullish(),
        kondisiIsi: z.enum(KONDISI_ISI).nullish(),
        tglKedaluwarsaTerdekat: z.iso.date().nullish(),
        tindakanRekomendasi: z.enum(TINDAKAN_REKOMENDASI).nullish(),
        uraianTindakan: z.string().max(500).nullish(),
        answeredAt: z.iso.datetime({ offset: true }).nullish(),
      }),
    )
    .max(200),
  photoIds: z.array(z.uuid()).max(200),
  /** Kamera terpandu: langkah tiap foto. Kiriman lama (sebelum kamera terpandu) tidak membawanya. */
  photos: z.array(z.object({ id: z.uuid(), langkah: z.string().max(64).nullable() })).max(200).optional(),
  kesimpulan: z.enum(KESIMPULAN),
  catatan: z.string().max(1000).nullish(),
  rekomendasi: z.string().max(1000).nullish(),
  deviceClockOffsetMs: z.number().int().default(0),
});

export type HasilFinal = {
  inspectionId: string;
  status: "final";
  kodeAset: string;
  inspectedAt: string;
  offline: boolean;
  kesimpulan: Kesimpulan;
  gateStatus: GateStatus;
  jarakM: number | null;
  qrVerified: boolean;
  jumlahFoto: number;
  temuan: { item: string; severity: string; tindakan: string | null }[];
};

async function ringkasan(tx: Tx, inspectionId: string): Promise<HasilFinal> {
  const [row] = await tx
    .select({ i: inspections, kode: assets.kode })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .where(eq(inspections.id, inspectionId));
  const temuan = await tx
    .select({ item: issues.item, severity: issues.severity, tindakan: issues.tindakanRekomendasi })
    .from(issues)
    .where(eq(issues.inspectionId, inspectionId))
    .orderBy(sql`case ${issues.severity} when 'berat' then 0 when 'sedang' then 1 else 2 end`, asc(issues.id));
  const [{ n }] = (await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.inspectionId, inspectionId))) as [{ n: number }];
  const i = row!.i;
  return {
    inspectionId,
    status: "final",
    kodeAset: row!.kode,
    inspectedAt: i.inspectedAt!.toISOString(),
    offline: i.offline,
    kesimpulan: i.kesimpulan!,
    gateStatus: i.gateStatus,
    jarakM: i.jarakM,
    qrVerified: i.qrVerified,
    jumlahFoto: n,
    temuan,
  };
}

/**
 * SPEC §3.7 + §7.5: satu transaksi, baris inspeksi dikunci (FOR UPDATE).
 * Inspeksi yang sudah final mengembalikan hasil yang sama (idempoten).
 */
export async function finalisasi(user: SessionUser, inspectionId: string, input: z.infer<typeof finalizeSchema>): Promise<HasilFinal> {
  const receivedAt = new Date();
  return db.transaction(async (tx) => {
    const ins = await drafMilik(tx, user, inspectionId, true);
    if (!ins) throw new GalatApi(409, "draf_tidak_ada", "Draf belum ada di peladen.");
    if (ins.status === "final") return ringkasan(tx, inspectionId);
    if (ins.assetId !== input.assetId) throw new GalatApi(409, "aset_berbeda", "Aset tidak cocok dengan draf.");

    const [{ a: aset, t: tipe }] = (await tx
      .select({ a: assets, t: assetTypes })
      .from(assets)
      .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
      .where(eq(assets.id, ins.assetId))) as [{ a: typeof assets.$inferSelect; t: typeof assetTypes.$inferSelect }];
    // Unit dapat berubah sejak draf dibuat (akun dipindah unit): diperiksa ulang saat final.
    await pastikanAsetUnit(tx, user, tipe.id);

    const butirRows = await tx
      .select({ i: checklistItems })
      .from(checklistItems)
      .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
      .where(and(eq(checklistGroups.assetTypeId, tipe.id), eq(checklistItems.aktif, true)))
      .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut));
    const items: ButirChecklist[] = butirRows.map(({ i }) => ({
      id: i.id,
      label: i.label,
      answerType: i.answerType,
      options: i.options,
      severityMap: i.severityMap,
      severityDefault: i.severityDefault,
      jumlahBaku: i.jumlahBaku,
      jumlahBakuPerTipe: i.jumlahBakuPerTipe,
      hasExpiry: i.hasExpiry,
      satuan: i.satuan,
      wajib: i.wajib,
      tindakanBawaan: i.tindakanBawaan,
    }));
    // Kotak P3K: kedaluwarsa dinilai terhadap tanggal kirim di perangkat (WIB).
    const p3k = konteksP3k(tipe.slug, aset.attributes, hariIniJakarta(new Date(input.submittedAtDevice)));

    const fotoAda = await tx
      .select({ id: inspectionPhotos.id, stepId: inspectionPhotos.stepId })
      .from(inspectionPhotos)
      .where(eq(inspectionPhotos.inspectionId, inspectionId));
    const idAda = new Set(fotoAda.map((f) => f.id));
    if ([...input.photoIds, ...(input.photos ?? []).map((p) => p.id)].some((p) => !idAda.has(p))) {
      throw new GalatApi(409, "foto_belum_lengkap", "Foto belum semuanya terunggah.");
    }

    // Syarat foto per langkah (PRD Aturan bukti 3-4). Langkah yang tersimpan saat unggah dipakai;
    // langkah dari kiriman hanya untuk foto yang belum punya. Tautan foto ke butir diturunkan dari langkahnya.
    const langkah = await langkahTipeAset(tx, tipe.id);
    const { terbatas: areaTerbatas } = await asetUntukFoto(tx, aset.id);
    const kodeDariId = new Map(langkah.filter((l) => l.id).map((l) => [l.id!, l.kode]));
    const kiriman = new Map((input.photos ?? []).map((p) => [p.id, p.langkah]));
    const galatFoto = input.photos
      ? periksaFotoLangkah(
          langkah,
          fotoAda.map((f) => ({ langkah: (f.stepId && kodeDariId.get(f.stepId)) || kiriman.get(f.id) || "" })),
          { areaTerbatas },
        )
      : undefined;
    const galat = periksaKirim(items, { ...input, jawaban: input.answers, jumlahFoto: idAda.size, galatFoto, p3k }, Math.max(MAKS_FOTO, maksFotoInspeksi(langkah)));
    if (galat.length) throw new GalatApi(422, "validasi", galat[0]!, galat);

    // Bukti QR: token mentah dicocokkan dengan assets.qr_token (SPEC §7.7, §7.8).
    const scanned = input.scannedAtDevice ? new Date(input.scannedAtDevice) : ins.scannedAtDevice;
    const scannedTerkoreksi = scanned ? new Date(scanned.getTime() + input.deviceClockOffsetMs) : null;
    const qrVerified =
      input.token === aset.qrToken ||
      (!!aset.qrTokenRotatedAt && !!scannedTerkoreksi && scannedTerkoreksi < aset.qrTokenRotatedAt && ins.qrVerified);

    // Gerbang GPS dihitung ulang dari nilai mentah (SPEC §7.3 butir 3).
    const radius = tipe.isMobile ? null : radiusEfektif({ radiusAset: aset.radiusM, lokasiTipe: aset.lokasiTipe });
    const jarak = input.gps ? jarakMeter(input.gps, aset) : null;
    const akurasi = input.gps ? Math.round(input.gps.accuracy) : null;
    const gateStatus = evaluasiGerbang({ radius, jarak, akurasi });

    const waktu = waktuResmi({
      receivedAt,
      submittedAtDevice: new Date(input.submittedAtDevice),
      offsetMs: input.deviceClockOffsetMs,
    });
    const durasiDetik =
      input.monoDurationMs != null
        ? Math.round(input.monoDurationMs / 1000)
        : ins.mulaiPada
          ? Math.round((waktu.inspectedAt.getTime() - ins.mulaiPada.getTime()) / 1000)
          : null;

    await tx
      .update(inspections)
      .set({
        status: "final",
        scannedAtDevice: scanned,
        submittedAtDevice: new Date(input.submittedAtDevice),
        receivedAt,
        inspectedAt: waktu.inspectedAt,
        offline: waktu.offline,
        clockSkewS: waktu.clockSkewS,
        durasiDetik,
        gpsLat: input.gps?.lat ?? null,
        gpsLng: input.gps?.lng ?? null,
        gpsAccuracy: akurasi,
        gpsCapturedAt: input.gps?.capturedAt ? new Date(input.gps.capturedAt) : null,
        jarakM: jarak,
        gateStatus,
        // PRD Aturan bukti 4: area terbatas otomatis ditandai dan masuk antrean tinjauan.
        restrictedArea: areaTerbatas,
        qrVerified,
        qrVerification: input.qrVerification,
        kesimpulan: input.kesimpulan,
        catatan: input.catatan?.trim() || null,
        rekomendasi: input.rekomendasi?.trim() || null,
      })
      .where(eq(inspections.id, inspectionId));

    await tx.delete(inspectionAnswers).where(eq(inspectionAnswers.inspectionId, inspectionId));
    if (input.answers.length) {
      await tx.insert(inspectionAnswers).values(
        input.answers.map((j) => ({
          inspectionId,
          checklistItemId: j.checklistItemId,
          nilai: j.nilai ?? null,
          nilaiAngka: j.nilaiAngka ?? null,
          kondisiIsi: j.kondisiIsi ?? null,
          tglKedaluwarsaTerdekat: j.tglKedaluwarsaTerdekat ?? null,
          catatan: j.catatan?.trim() || null,
          tindakanRekomendasi: j.tindakanRekomendasi ?? null,
          uraianTindakan: j.uraianTindakan?.trim() || null,
          answeredAtDevice: j.answeredAt ? new Date(j.answeredAt) : null,
        })),
      );
    }

    const tanggal = hariIniJakarta(waktu.inspectedAt);
    const [area] = aset.areaId ? await tx.select({ nama: areas.nama }).from(areas).where(eq(areas.id, aset.areaId)) : [];
    const lokasi = lokasiTemuan({
      area: area?.nama,
      gedung: aset.gedung,
      lantai: aset.lantai,
      lokasiTeks: aset.lokasiTeks,
      identitas: tipe.isMobile ? identitasDamkar(aset.attributes as AtributDamkar | null) : null,
    });
    await buatTemuan(tx, aset.id, inspectionId, lokasi, bangunTemuan(items, input.answers, p3k));

    await tx
      .update(assets)
      .set({ terakhirDicek: tanggal })
      .where(and(eq(assets.id, aset.id), sql`(${assets.terakhirDicek} is null or ${assets.terakhirDicek} <= ${tanggal})`));

    // SPEC §3.9: satu jadwal per aset per periode (minggu untuk mobil pemadam); inspeksi terakhir yang ditunjuk.
    const periode = periodeUntuk(tanggal, tipe.periodeHari);
    const tempo = jatuhTempoUntuk(periode, tipe.periodeHari);
    const status = tanggal <= tempo ? "selesai" : "telat";
    await tx
      .insert(schedules)
      .values({ assetId: aset.id, periode, jatuhTempo: tempo, inspectionId, status })
      .onConflictDoUpdate({ target: [schedules.assetId, schedules.periode], set: { inspectionId, status } });

    await tx.insert(auditLogs).values({
      userId: user.id,
      aksi: "inspeksi.final",
      entitas: "inspection",
      entitasId: inspectionId,
      data: { gateStatus, offline: waktu.offline, qrVerified },
    });

    return ringkasan(tx, inspectionId);
  });
}

/**
 * Temuan sederhana (PRD "Temuan", ADR-4): satu per butir gagal, dengan lokasi yang disalin saat
 * final dan tindakan yang direkomendasikan. Tanpa tenggat, PIC, atau jejak tindak lanjut.
 */
async function buatTemuan(tx: Tx, assetId: number, inspectionId: string, lokasi: string, temuan: Temuan[]) {
  await tx.delete(issues).where(eq(issues.inspectionId, inspectionId));
  if (!temuan.length) return;
  await tx.insert(issues).values(
    temuan.map((t) => ({
      assetId,
      inspectionId,
      checklistItemId: t.checklistItemId,
      item: t.item,
      severity: t.severity,
      lokasi,
      tindakanRekomendasi: t.tindakan,
      uraianTindakan: t.uraian ?? null,
    })),
  );
}
