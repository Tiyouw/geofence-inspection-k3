import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { assets, assetTypes } from "@/db/schema";
import { urlStiker } from "../lib/stiker";

export type FilterStiker = { tipe?: string; gedung?: string; lantai?: string; kode: string[] };

/**
 * Aset aktif untuk lembar stiker, urut gedung, lantai, kode (StikerController.php).
 * SATU-SATUNYA kueri yang memilih qr_token untuk ditampilkan; hanya dipanggil dari /stiker (admin).
 */
export async function asetStiker(f: FilterStiker) {
  return db
    .select({
      id: assets.id,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      qrToken: assets.qrToken,
      tipe: assetTypes.nama,
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(
      and(
        eq(assets.aktif, true),
        f.tipe ? eq(assetTypes.slug, f.tipe) : undefined,
        f.gedung ? eq(assets.gedung, f.gedung) : undefined,
        f.lantai ? eq(assets.lantai, f.lantai) : undefined,
        f.kode.length ? inArray(assets.kode, f.kode) : undefined,
      ),
    )
    .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode));
}

/**
 * QR SVG berisi URL lengkap /i/{token}, koreksi galat M (stiker di bengkel terkena debu dan
 * percikan cat; tingkat L terlalu rapat), margin 0.
 */
export async function qrSvg(origin: string, token: string): Promise<string> {
  return QRCode.toString(urlStiker(origin, token), { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}
