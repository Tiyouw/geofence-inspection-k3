import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { areas,
    assets,
    assetTypes,
    checklistGroups,
    checklistItems,
    inspectionAnswers,
    inspectionPhotos,
    inspections,
    issues,
    users,
} from "@/db/schema";
import {
    DURASI_WAJAR_DETIK,
    GATE_PERLU_TINJAUAN,
    GATE_STATUSES,
    KESIMPULAN,
    type GateStatus,
    type Kesimpulan,
} from "@/lib/domain/constants";
import { syaratAntreanTinjauan } from "./dasbor";

export const TAB_INSPEKSI = ["antre", "menyimpang", "tidak_layak", "semua"] as const;
export type TabInspeksi = (typeof TAB_INSPEKSI)[number];
export const LABEL_TAB_INSPEKSI: Record<TabInspeksi, string> = {
    antre: "Perlu tinjauan",
    menyimpang: "Pernah masuk antrean",
    tidak_layak: "Tidak layak pakai",
    semua: "Semua",
};

export type FilterInspeksi = {
    tab: TabInspeksi;
    gate?: GateStatus;
    kesimpulan?: Kesimpulan;
    inspektur?: number;
    aset?: number;
    durasiTakWajar?: boolean;
};

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Tab bawaan: Antre ditinjau bila ada antrean, selain itu Semua (H7). */
export function parseFilterInspeksi(
    sp: Record<string, string | string[] | undefined>,
    adaAntrean: boolean,
): FilterInspeksi {
    const tab = satu(sp.tab);
    const gate = satu(sp.gate);
    const kes = satu(sp.kesimpulan);
    const insp = Number(satu(sp.inspektur));
    const aset = Number(satu(sp.aset));
    return {
        tab:
            tab && (TAB_INSPEKSI as readonly string[]).includes(tab)
                ? (tab as TabInspeksi)
                : adaAntrean
                  ? "antre"
                  : "semua",
        gate: gate && (GATE_STATUSES as readonly string[]).includes(gate) ? (gate as GateStatus) : undefined,
        kesimpulan: kes && (KESIMPULAN as readonly string[]).includes(kes) ? (kes as Kesimpulan) : undefined,
        inspektur: Number.isInteger(insp) && insp > 0 ? insp : undefined,
        aset: Number.isInteger(aset) && aset > 0 ? aset : undefined,
        durasiTakWajar: sp.durasi === "1",
    };
}

function syaratTab(tab: TabInspeksi): SQL | undefined {
    switch (tab) {
        case "antre":
            return syaratAntreanTinjauan;
        case "menyimpang":
            return or(inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN), eq(inspections.restrictedArea, true));
        case "tidak_layak":
            return eq(inspections.kesimpulan, "tidak_layak");
        default:
            return undefined;
    }
}

export const PER_HALAMAN_INSPEKSI = 25;

export async function daftarInspeksi(f: FilterInspeksi, halaman = 1) {
    const syarat = and(
        syaratTab(f.tab),
        f.gate ? eq(inspections.gateStatus, f.gate) : undefined,
        f.kesimpulan ? eq(inspections.kesimpulan, f.kesimpulan) : undefined,
        f.inspektur ? eq(inspections.userId, f.inspektur) : undefined,
        f.aset ? eq(inspections.assetId, f.aset) : undefined,
        f.durasiTakWajar ? lt(inspections.durasiDetik, DURASI_WAJAR_DETIK) : undefined,
    );
    const peninjau = alias(users, "peninjau");
    const [rows, [jumlah], hitungTab] = await Promise.all([
        db
            .select({
                id: inspections.id,
                status: inspections.status,
                inspectedAt: inspections.inspectedAt,
                mulaiPada: inspections.mulaiPada,
                asetKode: assets.kode,
                asetTipe: sql<string | null>`(select t.slug from asset_types t where t.id = ${assets.assetTypeId})`,
                asetLokasi: assets.lokasiTeks,
                asetGedung: assets.gedung,
                asetLantai: assets.lantai,
                inspektur: users.name,
                qrVerified: inspections.qrVerified,
                gateStatus: inspections.gateStatus,
                jarakM: inspections.jarakM,
                gpsAccuracy: inspections.gpsAccuracy,
                kesimpulan: inspections.kesimpulan,
                durasiDetik: inspections.durasiDetik,
                offline: inspections.offline,
                ditinjauPada: inspections.ditinjauPada,
                catatanReview: inspections.catatanReview,
                hasilTinjauan: inspections.hasilTinjauan,
                gateAlasan: inspections.gateAlasan,
                restrictedArea: inspections.restrictedArea,
                peninjau: peninjau.name,
            })
            .from(inspections)
            .innerJoin(assets, eq(assets.id, inspections.assetId))
            .innerJoin(users, eq(users.id, inspections.userId))
            .leftJoin(peninjau, eq(peninjau.id, inspections.ditinjauOleh))
            .where(syarat)
            .orderBy(
                ...(f.tab === "antre"
                    ? [asc(inspections.inspectedAt), asc(inspections.id)]
                    : [sql`${inspections.inspectedAt} desc nulls first`, desc(inspections.createdAt)]),
            )
            .limit(PER_HALAMAN_INSPEKSI)
            .offset((halaman - 1) * PER_HALAMAN_INSPEKSI),
        db.select({ n: count() }).from(inspections).where(syarat),
        Promise.all([
            db.select({ n: count() }).from(inspections).where(syaratAntreanTinjauan),
            db.select({ n: count() }).from(inspections).where(eq(inspections.kesimpulan, "tidak_layak")),
        ]),
    ]);
    return {
        rows,
        total: jumlah?.n ?? 0,
        lencana: { antre: hitungTab[0][0]?.n ?? 0, tidak_layak: hitungTab[1][0]?.n ?? 0 },
    };
}

export async function daftarInspektur() {
    return db
        .select({ id: users.id, name: users.name, nip: users.nip })
        .from(users)
        .where(eq(users.role, "inspektur"))
        .orderBy(asc(users.name));
}

/** Detail inspeksi untuk admin: bukti lapangan (baca saja), jawaban, foto, temuan. Tanpa token. */
export async function detailInspeksi(id: string) {
    const peninjau = alias(users, "peninjau");
    const [i] = await db
        .select({
            id: inspections.id,
            status: inspections.status,
            inspectedAt: inspections.inspectedAt,
            mulaiPada: inspections.mulaiPada,
            receivedAt: inspections.receivedAt,
            durasiDetik: inspections.durasiDetik,
            offline: inspections.offline,
            clockSkewS: inspections.clockSkewS,
            ua: inspections.ua,
            gpsLat: inspections.gpsLat,
            gpsLng: inspections.gpsLng,
            gpsAccuracy: inspections.gpsAccuracy,
            gpsCapturedAt: inspections.gpsCapturedAt,
            jarakM: inspections.jarakM,
            gateStatus: inspections.gateStatus,
            gateAlasan: inspections.gateAlasan,
            restrictedArea: inspections.restrictedArea,
            qrVerified: inspections.qrVerified,
            qrVerification: inspections.qrVerification,
            kesimpulan: inspections.kesimpulan,
            catatan: inspections.catatan,
            rekomendasi: inspections.rekomendasi,
            ditinjauPada: inspections.ditinjauPada,
            catatanReview: inspections.catatanReview,
            peninjau: peninjau.name,
            inspektur: users.name,
            inspekturNip: users.nip,
            asetId: assets.id,
            asetKode: assets.kode,
            asetLokasi: assets.lokasiTeks,
            asetGedung: assets.gedung,
            asetLantai: assets.lantai,
            asetLat: assets.lat,
            asetLng: assets.lng,
            jarakKeAreaM: inspections.jarakKeAreaM,
            areaNama: areas.nama,
            areaPolygon: areas.polygon,
            tipe: assetTypes.nama,
        })
        .from(inspections)
        .innerJoin(assets, eq(assets.id, inspections.assetId))
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .innerJoin(users, eq(users.id, inspections.userId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .leftJoin(peninjau, eq(peninjau.id, inspections.ditinjauOleh))
        .where(eq(inspections.id, id));
    if (!i) return null;

    const [jawaban, foto, temuan] = await Promise.all([
        db
            .select({
                id: inspectionAnswers.id,
                grup: checklistGroups.nama,
                grupUrut: checklistGroups.urut,
                label: checklistItems.label,
                urut: checklistItems.urut,
                answerType: checklistItems.answerType,
                dasarHukum: checklistItems.dasarHukum,
                nilai: inspectionAnswers.nilai,
                nilaiAngka: inspectionAnswers.nilaiAngka,
                satuan: checklistItems.satuan,
                catatan: inspectionAnswers.catatan,
            })
            .from(inspectionAnswers)
            .innerJoin(checklistItems, eq(checklistItems.id, inspectionAnswers.checklistItemId))
            .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
            .where(eq(inspectionAnswers.inspectionId, id))
            .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut)),
        db
            .select({
                id: inspectionPhotos.id,
                width: inspectionPhotos.width,
                height: inspectionPhotos.height,
                takenAtDevice: inspectionPhotos.takenAtDevice,
                uploadedAt: inspectionPhotos.uploadedAt,
            })
            .from(inspectionPhotos)
            .where(eq(inspectionPhotos.inspectionId, id))
            .orderBy(asc(inspectionPhotos.uploadedAt)),
        db
            .select({
                id: issues.id,
                item: issues.item,
                severity: issues.severity,
                status: issues.status,
                targetSelesai: issues.targetSelesai,
            })
            .from(issues)
            .where(eq(issues.inspectionId, id))
            .orderBy(sql`case ${issues.severity} when 'berat' then 0 when 'sedang' then 1 else 2 end`, asc(issues.id)),
    ]);
    const perluTinjauan =
        i.status === "final" && (GATE_PERLU_TINJAUAN.includes(i.gateStatus) || i.restrictedArea) && i.ditinjauPada === null;
    return { ...i, perluTinjauan, jawaban, foto, temuan };
}
