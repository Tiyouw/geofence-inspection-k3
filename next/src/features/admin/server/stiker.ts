import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { areas, assets, assetTypes } from "@/db/schema";
import { urlStiker, type SaringStiker } from "../lib/stiker";

/** Area berpoligon disetujui (bukan kawasan): pilihan penyaring Area. */
const areaDisetujui = and(
    eq(areas.aktif, true),
    ne(areas.jenis, "kawasan"),
    isNotNull(areas.polygon),
    isNotNull(areas.poligonDisetujuiPada),
);

/** Pilihan penyaring lembar stiker: jenis objek, area berpoligon disetujui, lantai yang dipakai. */
export async function pilihanStiker() {
    const [tipe, area, lantai, [belum]] = await Promise.all([
        db.select({ slug: assetTypes.slug, nama: assetTypes.nama }).from(assetTypes).orderBy(asc(assetTypes.urut)),
        // Hanya area yang berisi aset aktif: denah impor bisa berisi ratusan gedung tanpa aset.
        db
            .select({ id: areas.id, nama: areas.nama })
            .from(areas)
            .where(and(areaDisetujui, sql`exists (select 1 from ${assets} where ${assets.areaId} = ${areas.id} and ${assets.aktif})`))
            .orderBy(asc(areas.nama)),
        db
            .selectDistinct({ l: assets.lantai })
            .from(assets)
            .where(sql`${assets.aktif} and ${assets.lantai} is not null and trim(${assets.lantai}) not in ('', '-', '–', '—')`)
            .orderBy(asc(assets.lantai)),
        db.select({ n: sql<number>`count(*)::int` }).from(assets).where(and(eq(assets.aktif, true), isNull(assets.areaId))),
    ]);
    return { tipe, area, lantai: lantai.map((r) => r.l!).sort((a, b) => a.localeCompare(b, "id", { numeric: true })), belumBerarea: belum?.n ?? 0 };
}

/**
 * Aset aktif untuk lembar stiker, urut area, lantai, kode (StikerController.php).
 * SATU-SATUNYA kueri yang memilih qr_token untuk ditampilkan; hanya dipanggil dari /stiker (admin).
 */
export async function asetStiker(f: SaringStiker) {
    return db
        .select({
            id: assets.id,
            kode: assets.kode,
            gedung: assets.gedung,
            area: areas.nama,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            qrToken: assets.qrToken,
            tipe: assetTypes.nama,
            slug: assetTypes.slug,
        })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .where(
            and(
                eq(assets.aktif, true),
                f.tipe.length ? inArray(assetTypes.slug, f.tipe) : undefined,
                f.area === "belum" ? isNull(assets.areaId) : f.area !== undefined ? eq(assets.areaId, f.area) : undefined,
                f.lantai ? eq(assets.lantai, f.lantai) : undefined,
                f.kode.length ? inArray(assets.kode, f.kode) : undefined,
            ),
        )
        .orderBy(sql`${areas.nama} asc nulls last`, asc(assets.gedung), asc(assets.lantai), asc(assets.kode));
}

/**
 * QR SVG berisi URL lengkap /i/{token}, koreksi galat M (stiker di bengkel terkena debu dan
 * percikan cat; tingkat L terlalu rapat), margin 4 (quiet zone).
 */
export async function qrSvg(origin: string, token: string): Promise<string> {
    // margin 4 = quiet zone baku QR (ISO/IEC 18004). Dengan margin 0, tepi QR menempel pada
    // garis potong label, label tetangga, atau latar layar gelap, dan pemindai (jsQR dan
    // BarcodeDetector) gagal menemukan pola pencari. Latar putih ikut tergambar di SVG.
    return QRCode.toString(urlStiker(origin, token), { type: "svg", errorCorrectionLevel: "M", margin: 4 });
}

/** Token dicetak berkelompok 4 karakter supaya mudah diketik ulang ("PAL-K3-da4f 8df0 …"). */
export function tokenTercetak(token: string): string {
    return token.startsWith("PAL-K3-") ? "PAL-K3-" + (token.slice(7).match(/.{1,4}/g) ?? []).join(" ") : token;
}
