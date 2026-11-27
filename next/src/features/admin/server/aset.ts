import "server-only";
import { and, asc, count, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, assetTypes, divisions } from "@/db/schema";
import { LOKASI_TIPE, type LokasiTipe } from "@/lib/domain/constants";
import { hariIniJakarta } from "@/lib/format";
import { polaMengandung } from "../lib/pencarian";

export type FilterAset = {
    q?: string;
    tipe?: string;
    gedung?: string;
    lokasiTipe?: LokasiTipe;
    aktif?: "ya" | "tidak";
    tanpaKoordinat?: boolean;
    jatuhTempo?: boolean;
    /** id area, atau "belum" = aset bertitik tetap yang belum dipasangkan ke area. */
    area?: number | "belum";
};

/** Nilai filter Area untuk aset yang belum dipasangkan ke area. */
export const AREA_BELUM = "belum";

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseFilterAset(sp: Record<string, string | string[] | undefined>): FilterAset {
    const lokasi = satu(sp.lokasi);
    const aktif = satu(sp.aktif);
    const area = satu(sp.area);
    return {
        area: area === AREA_BELUM ? AREA_BELUM : area && /^\d+$/.test(area) ? Number(area) : undefined,
        q: satu(sp.q),
        tipe: satu(sp.tipe),
        gedung: satu(sp.gedung),
        lokasiTipe: lokasi && (LOKASI_TIPE as readonly string[]).includes(lokasi) ? (lokasi as LokasiTipe) : undefined,
        aktif: aktif === "ya" || aktif === "tidak" ? aktif : undefined,
        tanpaKoordinat: sp.tanpa_koordinat === "1",
        jatuhTempo: sp.jatuh_tempo === "1",
    };
}

/** Setiap filter berdiri sendiri dan digabung AND, jadi "tanpa koordinat" tetap menghormati filter lain (H3). */
function syaratAset(f: FilterAset, hariIni: string): SQL | undefined {
    const s: (SQL | undefined)[] = [];
    if (f.q) {
        const pola = polaMengandung(f.q);
        s.push(
            or(
                sql`${assets.kode} ilike ${pola} escape '!'`,
                sql`${assets.lokasiTeks} ilike ${pola} escape '!'`,
                sql`coalesce(${assets.gedung}, '') ilike ${pola} escape '!'`,
            ),
        );
    }
    if (f.tipe) s.push(eq(assetTypes.slug, f.tipe));
    if (f.gedung) s.push(eq(assets.gedung, f.gedung));
    if (f.lokasiTipe) s.push(eq(assets.lokasiTipe, f.lokasiTipe));
    if (f.aktif) s.push(eq(assets.aktif, f.aktif === "ya"));
    if (f.tanpaKoordinat) s.push(or(isNull(assets.lat), isNull(assets.lng)));
    // Mobil pemadam tidak punya area (objek bergerak), jadi tidak dihitung "belum berarea".
    if (f.area === AREA_BELUM) s.push(and(isNull(assets.areaId), eq(assetTypes.isMobile, false)));
    else if (f.area !== undefined) s.push(eq(assets.areaId, f.area));
    // Celah #7: memakai periode_hari tipe objek, bukan 30 hari tetap.
    if (f.jatuhTempo) {
        s.push(
            or(
                isNull(assets.terakhirDicek),
                sql`${assets.terakhirDicek} + ${assetTypes.periodeHari}::int < ${hariIni}::date`,
            ),
        );
    }
    return and(...s);
}

export const PER_HALAMAN_ASET = 50;

export async function daftarAset(f: FilterAset, halaman = 1) {
    const syarat = syaratAset(f, hariIniJakarta());
    const dasar = db
        .select({
            id: assets.id,
            kode: assets.kode,
            tipe: assetTypes.nama,
            gedung: assets.gedung,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            area: areas.nama,
            lat: assets.lat,
            lng: assets.lng,
            divisi: divisions.nama,
            terakhirDicek: assets.terakhirDicek,
            aktif: assets.aktif,
            isMobile: assetTypes.isMobile,
        })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .leftJoin(divisions, eq(divisions.id, assets.divisionId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .where(syarat);
    const [rows, [jumlah]] = await Promise.all([
        dasar
            .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode))
            .limit(PER_HALAMAN_ASET)
            .offset((halaman - 1) * PER_HALAMAN_ASET),
        db
            .select({ n: count() })
            .from(assets)
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .where(syarat),
    ]);
    return { rows, total: jumlah?.n ?? 0 };
}

/** Aset untuk formulir ubah. qr_token sengaja tidak dipilih. */
export async function ambilAset(id: number) {
    const [a] = await db
        .select({
            id: assets.id,
            assetTypeId: assets.assetTypeId,
            divisionId: assets.divisionId,
            kode: assets.kode,
            gedung: assets.gedung,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            areaId: assets.areaId,
            lat: assets.lat,
            lng: assets.lng,
            attributes: assets.attributes,
            tglExpired: assets.tglExpired,
            terakhirDicek: assets.terakhirDicek,
            aktif: assets.aktif,
            qrTokenRotatedAt: assets.qrTokenRotatedAt,
            createdAt: assets.createdAt,
        })
        .from(assets)
        .where(eq(assets.id, id));
    return a ?? null;
}

/**
 * Pilihan penyaring daftar aset: tanpa poligon, dan area hanya yang berisi aset aktif (ditambah
 * area yang sedang dipilih). Denah impor bisa berisi ratusan gedung tanpa aset; menaruh semuanya
 * di penyaring membuat halaman ratusan KB di ponsel (audit 19 Nov 2026, S13).
 */
export async function pilihanFilterAset(areaTerpilih?: number) {
    const [tipe, area] = await Promise.all([
        db
            .select({ id: assetTypes.id, slug: assetTypes.slug, nama: assetTypes.nama, isMobile: assetTypes.isMobile })
            .from(assetTypes)
            .orderBy(asc(assetTypes.urut)),
        db
            .select({ id: areas.id, nama: areas.nama })
            .from(areas)
            .where(
                and(
                    eq(areas.aktif, true),
                    ne(areas.jenis, "kawasan"),
                    or(
                        sql`exists (select 1 from ${assets} where ${assets.areaId} = ${areas.id} and ${assets.aktif})`,
                        areaTerpilih !== undefined ? eq(areas.id, areaTerpilih) : undefined,
                    ),
                ),
            )
            .orderBy(asc(areas.nama)),
    ]);
    return { tipe, area };
}

export async function pilihanAset() {
    const [tipe, divisi, gedung, area] = await Promise.all([
        db
            .select({ id: assetTypes.id, slug: assetTypes.slug, nama: assetTypes.nama, isMobile: assetTypes.isMobile })
            .from(assetTypes)
            .orderBy(asc(assetTypes.urut)),
        db
            .select({ id: divisions.id, nama: divisions.nama })
            .from(divisions)
            .where(eq(divisions.aktif, true))
            .orderBy(asc(divisions.nama)),
        daftarGedung(),
        db
            .select({ id: areas.id, nama: areas.nama, jenis: areas.jenis, polygon: areas.polygon, polygonDraf: areas.polygonDraf })
            .from(areas)
            .where(and(eq(areas.aktif, true), ne(areas.jenis, "kawasan")))
            .orderBy(asc(areas.nama)),
    ]);
    return { tipe, divisi, gedung, area };
}

/** Jumlah aset aktif bertitik tetap yang belum berarea dan yang belum punya koordinat (untuk label filter). */
export async function hitungBelumLengkap() {
    const [r] = await db
        .select({
            belumArea: sql<number>`count(*) filter (where ${assets.areaId} is null and not ${assetTypes.isMobile})::int`,
            belumKoordinat: sql<number>`count(*) filter (where ${assets.lat} is null or ${assets.lng} is null)::int`,
        })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .where(eq(assets.aktif, true));
    return { belumArea: r?.belumArea ?? 0, belumKoordinat: r?.belumKoordinat ?? 0 };
}

export async function daftarGedung(): Promise<string[]> {
    const rows = await db
        .selectDistinct({ g: assets.gedung })
        .from(assets)
        .where(sql`${assets.gedung} is not null and ${assets.gedung} <> ''`)
        .orderBy(asc(assets.gedung));
    return rows.map((r) => r.g!);
}
