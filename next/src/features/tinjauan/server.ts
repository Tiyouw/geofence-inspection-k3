import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
    areas,
    assetTypes,
    assets,
    checklistGroups,
    checklistItems,
    inspectionAnswers,
    inspections,
    users,
} from "@/db/schema";
import { fotoPerButir } from "@/features/inspeksi/server/foto-butir";
import { capKoordinatAktif } from "@/lib/foto/pengaturan";
import { GATE_PERLU_TINJAUAN } from "@/lib/domain/constants";
import { lokasiTemuan } from "@/lib/domain/temuan";

/**
 * Antrean tinjauan bersama Administrator K3 dan Pemantau (PRD F13, ADR-9): inspeksi final yang
 * gerbangnya "perlu tinjauan" (atau status lama yang setara) atau asetnya di area terbatas,
 * dan belum ditinjau. Satu tinjauan per inspeksi: peninjau pertama tercatat dan inspeksi keluar
 * dari antrean keduanya.
 */
export const syaratAntreanTinjauan = and(
    eq(inspections.status, "final"),
    or(inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN), eq(inspections.restrictedArea, true)),
    isNull(inspections.ditinjauPada),
);

/** Inspeksi yang pernah masuk antrean (menunggu atau sudah ditinjau). */
const pernahAntre = and(
    eq(inspections.status, "final"),
    or(
        inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN),
        eq(inspections.restrictedArea, true),
        isNotNull(inspections.ditinjauPada),
    ),
);

export const TAB_TINJAUAN = ["menunggu", "ditinjau"] as const;
export type TabTinjauan = (typeof TAB_TINJAUAN)[number];
export const LABEL_TAB_TINJAUAN: Record<TabTinjauan, string> = {
    menunggu: "Perlu tinjauan",
    ditinjau: "Sudah ditinjau",
};
export const PER_HALAMAN_TINJAUAN = 25;

export function parseTabTinjauan(v: string | string[] | undefined): TabTinjauan {
    return v === "ditinjau" ? "ditinjau" : "menunggu";
}

const peninjau = alias(users, "peninjau");

export async function daftarTinjauan(tab: TabTinjauan, halaman = 1) {
    const where: SQL | undefined =
        tab === "menunggu" ? syaratAntreanTinjauan : and(pernahAntre, isNotNull(inspections.ditinjauPada));
    const [rows, [jumlah]] = await Promise.all([
        db
            .select({
                id: inspections.id,
                inspectedAt: inspections.inspectedAt,
                gateStatus: inspections.gateStatus,
                gateAlasan: inspections.gateAlasan,
                restrictedArea: inspections.restrictedArea,
                gpsAccuracy: inspections.gpsAccuracy,
                jarakKeAreaM: inspections.jarakKeAreaM,
                jarakM: inspections.jarakM,
                kesimpulan: inspections.kesimpulan,
                hasilTinjauan: inspections.hasilTinjauan,
                ditinjauPada: inspections.ditinjauPada,
                catatanReview: inspections.catatanReview,
                peninjau: peninjau.name,
                inspektur: users.name,
                modul: assetTypes.nama,
                asetKode: assets.kode,
                asetGedung: assets.gedung,
                asetLantai: assets.lantai,
                asetLokasi: assets.lokasiTeks,
                area: areas.nama,
            })
            .from(inspections)
            .innerJoin(assets, eq(assets.id, inspections.assetId))
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .innerJoin(users, eq(users.id, inspections.userId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .leftJoin(peninjau, eq(peninjau.id, inspections.ditinjauOleh))
            .where(where)
            .orderBy(
                ...(tab === "menunggu"
                    ? [asc(inspections.inspectedAt), asc(inspections.id)]
                    : [desc(inspections.ditinjauPada), desc(inspections.id)]),
            )
            .limit(PER_HALAMAN_TINJAUAN)
            .offset((halaman - 1) * PER_HALAMAN_TINJAUAN),
        db.select({ n: count() }).from(inspections).where(where),
    ]);
    return {
        rows: rows.map((r) => ({
            ...r,
            lokasi: lokasiTemuan({
                area: r.area,
                gedung: r.asetGedung,
                lantai: r.asetLantai,
                lokasiTeks: r.asetLokasi,
            }),
        })),
        total: jumlah?.n ?? 0,
    };
}

/** Angka untuk dasbor dan lencana menu: antrean, rinciannya, dan keputusan sejak `sejak`. */
export async function hitungTinjauan(sejak?: Date) {
    const [[menunggu], [terbatas], [lemah], keputusan] = await Promise.all([
        db.select({ n: count() }).from(inspections).where(syaratAntreanTinjauan),
        db
            .select({ n: count() })
            .from(inspections)
            .where(and(syaratAntreanTinjauan, eq(inspections.restrictedArea, true))),
        db
            .select({ n: count() })
            .from(inspections)
            .where(and(syaratAntreanTinjauan, eq(inspections.gateAlasan, "gps_lemah"))),
        db
            .select({ hasil: inspections.hasilTinjauan, n: count() })
            .from(inspections)
            .where(and(isNotNull(inspections.hasilTinjauan), sejak ? gte(inspections.ditinjauPada, sejak) : undefined))
            .groupBy(inspections.hasilTinjauan),
    ]);
    const per = new Map(keputusan.map((k) => [k.hasil, k.n]));
    return {
        menunggu: menunggu?.n ?? 0,
        areaTerbatas: terbatas?.n ?? 0,
        gpsLemah: lemah?.n ?? 0,
        diterima: per.get("diterima") ?? 0,
        ditolak: per.get("ditolak") ?? 0,
    };
}

/** Bahan halaman tinjauan: bukti posisi, poligon area dan kawasan, foto per butir, jawaban. */
export async function detailTinjauan(id: string) {
    const areaTerdeteksi = alias(areas, "area_terdeteksi");
    const [i] = await db
        .select({
            id: inspections.id,
            status: inspections.status,
            inspectedAt: inspections.inspectedAt,
            receivedAt: inspections.receivedAt,
            offline: inspections.offline,
            durasiDetik: inspections.durasiDetik,
            gpsLat: inspections.gpsLat,
            gpsLng: inspections.gpsLng,
            gpsAccuracy: inspections.gpsAccuracy,
            gpsCapturedAt: inspections.gpsCapturedAt,
            jarakM: inspections.jarakM,
            jarakKeAreaM: inspections.jarakKeAreaM,
            gateStatus: inspections.gateStatus,
            gateAlasan: inspections.gateAlasan,
            restrictedArea: inspections.restrictedArea,
            qrVerified: inspections.qrVerified,
            kesimpulan: inspections.kesimpulan,
            catatan: inspections.catatan,
            rekomendasi: inspections.rekomendasi,
            hasilTinjauan: inspections.hasilTinjauan,
            ditinjauPada: inspections.ditinjauPada,
            catatanReview: inspections.catatanReview,
            peninjau: peninjau.name,
            inspektur: users.name,
            inspekturNip: users.nip,
            modul: assetTypes.nama,
            bergerak: assetTypes.isMobile,
            asetId: assets.id,
            asetKode: assets.kode,
            asetGedung: assets.gedung,
            asetLantai: assets.lantai,
            asetLokasi: assets.lokasiTeks,
            asetLat: assets.lat,
            asetLng: assets.lng,
            areaId: areas.id,
            area: areas.nama,
            areaPoligon: areas.polygon,
            areaParentId: areas.parentId,
            areaTerdeteksi: areaTerdeteksi.nama,
        })
        .from(inspections)
        .innerJoin(assets, eq(assets.id, inspections.assetId))
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .innerJoin(users, eq(users.id, inspections.userId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .leftJoin(areaTerdeteksi, eq(areaTerdeteksi.id, inspections.detectedAreaId))
        .leftJoin(peninjau, eq(peninjau.id, inspections.ditinjauOleh))
        .where(eq(inspections.id, id));
    if (!i) return null;

    const [kawasan, jawaban, foto, koordinatTampil] = await Promise.all([
        db
            .select({ id: areas.id, nama: areas.nama, polygon: areas.polygon })
            .from(areas)
            .where(
                and(
                    eq(areas.jenis, "kawasan"),
                    eq(areas.aktif, true),
                    i.areaParentId ? eq(areas.id, i.areaParentId) : undefined,
                ),
            )
            .limit(1)
            .then((r) => r[0] ?? null),
        db
            .select({
                checklistItemId: checklistItems.id,
                label: checklistItems.label,
                urut: checklistItems.urut,
                grup: checklistGroups.nama,
                answerType: checklistItems.answerType,
                satuan: checklistItems.satuan,
                nilai: inspectionAnswers.nilai,
                nilaiAngka: inspectionAnswers.nilaiAngka,
                catatan: inspectionAnswers.catatan,
            })
            .from(inspectionAnswers)
            .innerJoin(checklistItems, eq(checklistItems.id, inspectionAnswers.checklistItemId))
            .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
            .where(eq(inspectionAnswers.inspectionId, id))
            .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut)),
        // Tautan foto ke butir diturunkan dari langkahnya (kamera terpandu, sesi C).
        fotoPerButir(id),
        // Koordinat mentah hanya bila admin menyalakan pengaturan koordinat (bawaan mati, denah rahasia).
        capKoordinatAktif(),
    ]);

    return {
        ...i,
        menunggu: i.status === "final" && i.ditinjauPada === null && (GATE_PERLU_TINJAUAN.includes(i.gateStatus) || i.restrictedArea),
        kawasan,
        koordinatTampil,
        butir: jawaban,
        foto,
    };
}

export type DetailTinjauan = NonNullable<Awaited<ReturnType<typeof detailTinjauan>>>;
