import "server-only";
import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
    areas,
    assetTypes,
    assets,
    checklistItems,
    divisions,
    inspectionAnswers,
    inspections,
    issues,
    users,
} from "@/db/schema";
import { polaMengandung } from "@/features/admin/lib/pencarian";
import { fotoPerButir } from "@/features/inspeksi/server/foto-butir";
import { tindakanBawaan } from "@/lib/domain/inspeksi";
import { lokasiTemuan } from "@/lib/domain/temuan";
import { lingkupRekap, type FilterTemuan } from "./filter";
import { kolomTandaTangan, rakitRekapTemuan } from "./rekap";

export const PER_HALAMAN_TEMUAN = 25;

/** Awal hari "YYYY-MM-DD" WIB sebagai instan UTC. */
const awalHariWib = (t: string) => new Date(Date.parse(`${t}T00:00:00Z`) - 7 * 3_600_000);
const besok = (t: string) => {
    const d = new Date(`${t}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
};

/** Waktu temuan = waktu resmi inspeksinya (temuan lahir saat final); data lama memakai created_at. */
const waktuTemuan = sql<Date>`coalesce(${inspections.inspectedAt}, ${issues.createdAt})`;

function syarat(f: FilterTemuan): SQL | undefined {
    return and(
        f.modul ? eq(assetTypes.slug, f.modul) : undefined,
        f.area ? eq(assets.areaId, f.area) : undefined,
        f.tingkat ? eq(issues.severity, f.tingkat) : undefined,
        f.dari ? gte(waktuTemuan, awalHariWib(f.dari)) : undefined,
        f.sampai ? lt(waktuTemuan, awalHariWib(besok(f.sampai))) : undefined,
        f.q
            ? sql`(${issues.item} ilike ${polaMengandung(f.q)} escape '!' or ${assets.kode} ilike ${polaMengandung(f.q)} escape '!')`
            : undefined,
    );
}

/**
 * Berapa kali butir yang sama pada aset yang sama sudah menjadi temuan, sampai temuan ini
 * (PRD "Temuan berulang"). 1 = pertama kali.
 */
const berulang = sql<number>`(select count(*)::int from ${issues} i2 where i2.asset_id = ${issues.assetId} and i2.checklist_item_id = ${issues.checklistItemId} and i2.id <= ${issues.id})`;

function pilihBaris() {
    return {
        id: issues.id,
        item: issues.item,
        severity: issues.severity,
        lokasiTersimpan: issues.lokasi,
        tindakanRekomendasi: issues.tindakanRekomendasi,
        uraianTindakan: issues.uraianTindakan,
        tindakanBawaanButir: checklistItems.tindakanBawaan,
        dasarHukum: checklistItems.dasarHukum,
        checklistItemId: issues.checklistItemId,
        createdAt: issues.createdAt,
        waktu: waktuTemuan,
        inspectionId: issues.inspectionId,
        asetId: assets.id,
        asetKode: assets.kode,
        asetGedung: assets.gedung,
        asetLantai: assets.lantai,
        asetLokasi: assets.lokasiTeks,
        area: areas.nama,
        modul: assetTypes.nama,
        modulSlug: assetTypes.slug,
        inspektur: users.name,
        berulang,
    };
}

type BarisMentah = {
    severity: (typeof issues.$inferSelect)["severity"];
    lokasiTersimpan: string | null;
    tindakanRekomendasi: (typeof issues.$inferSelect)["tindakanRekomendasi"];
    tindakanBawaanButir: (typeof checklistItems.$inferSelect)["tindakanBawaan"] | null;
    asetGedung: string | null;
    asetLantai: string | null;
    asetLokasi: string;
    area: string | null;
    waktu: Date | string;
};

/** Lokasi dan tindakan siap tampil, dengan cadangan untuk temuan sebelum v2 (kolom kosong). */
function rapikan<T extends BarisMentah>(r: T) {
    return {
        ...r,
        waktu: new Date(r.waktu),
        lokasi:
            r.lokasiTersimpan ??
            lokasiTemuan({ area: r.area, gedung: r.asetGedung, lantai: r.asetLantai, lokasiTeks: r.asetLokasi }),
        tindakan: r.tindakanRekomendasi ?? tindakanBawaan({ tindakanBawaan: r.tindakanBawaanButir }, r.severity),
    };
}

function dasar() {
    return db
        .select(pilihBaris())
        .from(issues)
        .innerJoin(assets, eq(assets.id, issues.assetId))
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .leftJoin(inspections, eq(inspections.id, issues.inspectionId))
        .leftJoin(users, eq(users.id, inspections.userId))
        .leftJoin(checklistItems, eq(checklistItems.id, issues.checklistItemId))
        .$dynamic();
}

export type BarisTemuan = ReturnType<typeof rapikan<Awaited<ReturnType<typeof dasar>>[number]>>;

const urutTingkat = sql`case ${issues.severity} when 'berat' then 0 when 'sedang' then 1 else 2 end`;

/** Daftar temuan lintas modul dan gedung untuk Admin K3 dan Pemantau, terbaru dulu. */
export async function daftarTemuan(f: FilterTemuan, halaman = 1) {
    const where = syarat(f);
    const [rows, [jumlah]] = await Promise.all([
        dasar()
            .where(where)
            .orderBy(desc(waktuTemuan), urutTingkat, asc(issues.id))
            .limit(PER_HALAMAN_TEMUAN)
            .offset((halaman - 1) * PER_HALAMAN_TEMUAN),
        db
            .select({ n: count() })
            .from(issues)
            .innerJoin(assets, eq(assets.id, issues.assetId))
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .leftJoin(inspections, eq(inspections.id, issues.inspectionId))
            .where(where),
    ]);
    return { rows: rows.map(rapikan), total: jumlah?.n ?? 0 };
}

/** Semua temuan untuk rekap PDF: berat → ringan, lalu terlama (tanpa paginasi). */
export async function temuanUntukRekap(f: FilterTemuan) {
    const rows = await dasar().where(syarat(f)).orderBy(urutTingkat, asc(waktuTemuan), asc(issues.id));
    return rows.map(rapikan);
}

/** Pilihan saringan: modul aktif dan area bertipe gedung/bengkel/dok/dermaga. */
export async function pilihanFilterTemuan() {
    const [modul, area] = await Promise.all([
        db
            .select({ slug: assetTypes.slug, nama: assetTypes.nama })
            .from(assetTypes)
            .where(eq(assetTypes.aktif, true))
            .orderBy(asc(assetTypes.urut)),
        db
            .select({ id: areas.id, nama: areas.nama })
            .from(areas)
            .where(and(eq(areas.aktif, true), sql`${areas.jenis} <> 'kawasan'`))
            .orderBy(asc(areas.nama)),
    ]);
    return { modul, area };
}

/** Detail satu temuan beserta rujukannya: aset, inspeksi, jawaban butir, foto butir. */
export async function detailTemuan(id: number) {
    const [t] = await dasar().where(eq(issues.id, id));
    if (!t) return null;
    const peninjau = alias(users, "peninjau");
    const [ins, jawaban, foto] = await Promise.all([
        t.inspectionId
            ? db
                  .select({
                      id: inspections.id,
                      inspectedAt: inspections.inspectedAt,
                      kesimpulan: inspections.kesimpulan,
                      gateStatus: inspections.gateStatus,
                      rekomendasi: inspections.rekomendasi,
                      hasilTinjauan: inspections.hasilTinjauan,
                      peninjau: peninjau.name,
                  })
                  .from(inspections)
                  .leftJoin(peninjau, eq(peninjau.id, inspections.ditinjauOleh))
                  .where(eq(inspections.id, t.inspectionId))
                  .then((r) => r[0] ?? null)
            : null,
        t.inspectionId && t.checklistItemId
            ? db
                  .select({ catatan: inspectionAnswers.catatan })
                  .from(inspectionAnswers)
                  .where(
                      and(
                          eq(inspectionAnswers.inspectionId, t.inspectionId),
                          eq(inspectionAnswers.checklistItemId, t.checklistItemId),
                      ),
                  )
                  .then((r) => r[0] ?? null)
            : null,
        t.inspectionId ? fotoButir(t.inspectionId, t.checklistItemId) : [],
    ]);
    return { ...rapikan(t), inspeksi: ins, catatanButir: jawaban?.catatan ?? null, foto };
}

/**
 * Foto yang membuktikan butir temuan, lewat langkah kamera terpandu (ADR-8, fotoPerButir sesi C).
 * Bila inspeksi belum memakai kamera terpandu, foto tanpa langkah ditampilkan.
 */
async function fotoButir(inspectionId: string, checklistItemId: number | null) {
    const data = await fotoPerButir(inspectionId);
    if (!data) return [];
    const butir = data.butir.find((b) => b.id === checklistItemId)?.foto ?? [];
    return butir.length ? butir : data.tanpaLangkah;
}

/** Bahan PDF rekap temuan: judul, lingkup, baris, dan tanda tangan per unit pemilik modul. */
export async function isiRekapTemuan(f: FilterTemuan & { dari: string; sampai: string }) {
    const [rows, modul, area, [{ n: totalUnit } = { n: 0 }]] = await Promise.all([
        temuanUntukRekap(f),
        db
            .select({ slug: assetTypes.slug, nama: assetTypes.nama, unit: divisions.nama })
            .from(assetTypes)
            .leftJoin(divisions, eq(divisions.id, assetTypes.ownerDivisionId))
            .where(and(eq(assetTypes.aktif, true), f.modul ? eq(assetTypes.slug, f.modul) : undefined))
            .orderBy(asc(assetTypes.urut)),
        f.area ? db.select({ nama: areas.nama }).from(areas).where(eq(areas.id, f.area)) : Promise.resolve([]),
        db
            .select({ n: count() })
            .from(assets)
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .where(
                and(
                    eq(assets.aktif, true),
                    eq(assetTypes.aktif, true),
                    f.modul ? eq(assetTypes.slug, f.modul) : undefined,
                    f.area ? eq(assets.areaId, f.area) : undefined,
                ),
            ),
    ]);
    const unit = [...new Set(modul.map((m) => m.unit).filter((u): u is string => !!u))];
    const judulModul = f.modul ? (modul[0]?.nama ?? f.modul) : "Semua modul";
    return {
        judulModul,
        lingkup: lingkupRekap(f, area[0]?.nama ?? null),
        rekap: rakitRekapTemuan(rows, totalUnit),
        tandaTangan: kolomTandaTangan(unit),
    };
}
