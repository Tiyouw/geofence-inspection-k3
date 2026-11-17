import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  assetTypes,
  auditLogs,
  checklistGroups,
  checklistItems,
  divisions,
  inspectionAnswers,
  inspectionPhotos,
  inspections,
  issueEvents,
  issues,
  schedules,
} from "@/db/schema";
import { bolehInspeksiAset, pesanAsetUnitLain } from "@/lib/domain/akses";
import { evaluasiGerbang, jarakMeter, radiusEfektif } from "@/lib/domain/asset";
import { KESIMPULAN, KONDISI_ISI, MAKS_BYTE_FOTO, MAKS_FOTO, type GateStatus, type Kesimpulan } from "@/lib/domain/constants";
import { konteksP3k } from "@/lib/domain/modul/p3k";
import {
  bangunTemuan,
  jatuhTempo,
  periksaKirim,
  periodeDari,
  tenggatTemuan,
  waktuResmi,
  type ButirChecklist,
  type Temuan,
} from "@/lib/domain/inspeksi";
import { hariIniJakarta } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/guards";
import { hapusFoto, kunciFoto, sha256Hex, simpanFoto } from "@/lib/storage/photos";
import { GalatApi } from "./http";

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

const TIPE_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function unggahFoto(
  user: SessionUser,
  inspectionId: string,
  photoId: string,
  body: Uint8Array,
  meta: { contentType: string; sha256: string | null; takenAt: string | null; lat: number | null; lng: number | null; width: number | null; height: number | null },
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

  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.inspectionId, inspectionId))) as [{ n: number }];
  if (n >= MAKS_FOTO) throw new GalatApi(422, "foto_maks", `Foto paling banyak ${MAKS_FOTO}.`);

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
        answeredAt: z.iso.datetime({ offset: true }).nullish(),
      }),
    )
    .max(200),
  photoIds: z.array(z.uuid()).max(MAKS_FOTO),
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
  temuan: { item: string; severity: string; targetSelesai: string | null }[];
};

async function ringkasan(tx: Tx, inspectionId: string): Promise<HasilFinal> {
  const [row] = await tx
    .select({ i: inspections, kode: assets.kode })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .where(eq(inspections.id, inspectionId));
  const temuan = await tx
    .select({ item: issues.item, severity: issues.severity, targetSelesai: issues.targetSelesai })
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
    }));
    // Kotak P3K: kedaluwarsa dinilai terhadap tanggal kirim di perangkat (WIB).
    const p3k = konteksP3k(tipe.slug, aset.attributes, hariIniJakarta(new Date(input.submittedAtDevice)));

    const fotoAda = await tx
      .select({ id: inspectionPhotos.id })
      .from(inspectionPhotos)
      .where(eq(inspectionPhotos.inspectionId, inspectionId));
    const idAda = new Set(fotoAda.map((f) => f.id));
    if (input.photoIds.some((p) => !idAda.has(p))) {
      throw new GalatApi(409, "foto_belum_lengkap", "Foto belum semuanya terunggah.");
    }

    const galat = periksaKirim(items, { ...input, jawaban: input.answers, jumlahFoto: idAda.size, p3k }, MAKS_FOTO);
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
          answeredAtDevice: j.answeredAt ? new Date(j.answeredAt) : null,
        })),
      );
    }

    const tanggal = hariIniJakarta(waktu.inspectedAt);
    await buatTemuan(tx, user, aset.id, inspectionId, tanggal, bangunTemuan(items, input.answers, p3k));

    await tx
      .update(assets)
      .set({ terakhirDicek: tanggal })
      .where(and(eq(assets.id, aset.id), sql`(${assets.terakhirDicek} is null or ${assets.terakhirDicek} <= ${tanggal})`));

    // SPEC §3.9: satu jadwal per aset per periode; inspeksi terakhir yang ditunjuk.
    const periode = periodeDari(tanggal);
    const tempo = jatuhTempo(periode, tipe.periodeHari);
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

async function buatTemuan(tx: Tx, user: SessionUser, assetId: number, inspectionId: string, tanggal: string, temuan: Temuan[]) {
  await tx.delete(issues).where(eq(issues.inspectionId, inspectionId));
  for (const t of temuan) {
    const [issue] = await tx
      .insert(issues)
      .values({
        assetId,
        inspectionId,
        checklistItemId: t.checklistItemId,
        item: t.item,
        severity: t.severity,
        status: "terbuka",
        targetSelesai: tenggatTemuan(tanggal, t.severity),
      })
      .returning({ id: issues.id });
    await tx.insert(issueEvents).values({ issueId: issue!.id, userId: user.id, aksi: "dibuat", ke: { status: "terbuka", severity: t.severity } });
  }
}
