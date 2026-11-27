import "server-only";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, assetTypes, divisions } from "@/db/schema";
import type { AreaJenis } from "@/lib/domain/constants";
import type { GeometriArea } from "@/lib/geo/geometri";

export type AreaEditor = {
    id: number;
    kode: string;
    nama: string;
    jenis: AreaJenis;
    polygon: GeometriArea | null;
    polygonDraf: GeometriArea | null;
    disetujuiPada: string | null;
    restricted: boolean;
    parentId: number | null;
    divisionId: number | null;
    jumlahAset: number;
    /** Waktu dibuat; satu kali impor berjalan dalam satu transaksi, jadi sama untuk satu kumpulan. */
    dibuatPada: string;
};

export type AsetEditor = {
    id: number;
    kode: string;
    tipe: string;
    lokasiTeks: string;
    lat: number | null;
    lng: number | null;
    areaId: number | null;
    aktif: boolean;
};

/** Semua area aktif beserta jumlah aset, untuk editor `/admin/lokasi`. */
export async function dataEditorArea() {
    const [daftar, jumlah, aset, unit] = await Promise.all([
        db
            .select({
                id: areas.id,
                kode: areas.kode,
                nama: areas.nama,
                jenis: areas.jenis,
                polygon: areas.polygon,
                polygonDraf: areas.polygonDraf,
                disetujuiPada: areas.poligonDisetujuiPada,
                restricted: areas.restricted,
                parentId: areas.parentId,
                divisionId: areas.divisionId,
                dibuatPada: areas.createdAt,
            })
            .from(areas)
            .where(eq(areas.aktif, true))
            .orderBy(sql`case when ${areas.jenis} = 'kawasan' then 0 else 1 end`, asc(areas.nama)),
        db
            .select({ areaId: assets.areaId, n: count() })
            .from(assets)
            .where(eq(assets.aktif, true))
            .groupBy(assets.areaId),
        db
            .select({
                id: assets.id,
                kode: assets.kode,
                tipe: assetTypes.nama,
                lokasiTeks: assets.lokasiTeks,
                lat: assets.lat,
                lng: assets.lng,
                areaId: assets.areaId,
                aktif: assets.aktif,
                bergerak: assetTypes.isMobile,
            })
            .from(assets)
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .orderBy(asc(assets.kode)),
        db.select({ id: divisions.id, nama: divisions.nama }).from(divisions).orderBy(asc(divisions.nama)),
    ]);
    const per = new Map(jumlah.map((j) => [j.areaId, j.n]));
    const area: AreaEditor[] = daftar.map((a) => ({
        ...a,
        disetujuiPada: a.disetujuiPada?.toISOString() ?? null,
        dibuatPada: a.dibuatPada.toISOString(),
        jumlahAset: per.get(a.id) ?? 0,
    }));
    // Objek bergerak (mobil pemadam) tidak punya area: tidak ditampilkan di editor.
    const daftarAset: AsetEditor[] = aset.filter((a) => !a.bergerak);
    return { area, aset: daftarAset, unit };
}
