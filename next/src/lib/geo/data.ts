import "server-only";
/**
 * Data gerbang dari basis data: pengaturan toleransi (tabel `settings`) dan poligon area.
 * Dipakai finalisasi inspeksi (keputusan resmi) dan paket kerja inspektur (pratinjau).
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { areas, settings } from "@/db/schema";
import { SETTING_GERBANG } from "@/lib/domain/constants";
import { bacaPengaturanGerbang, type PengaturanGerbang } from "./akurasi";
import { batasGeometri, type BatasPeta } from "./geometri";
import { nilaiGerbang, type AreaGerbang, type HasilGerbang } from "./gerbang";

type Pembaca = Pick<typeof db, "select">;

export async function pengaturanGerbang(tx: Pembaca = db): Promise<PengaturanGerbang> {
  const rows = await tx
    .select({ kunci: settings.kunci, nilai: settings.nilai })
    .from(settings)
    .where(inArray(settings.kunci, Object.values(SETTING_GERBANG)));
  return bacaPengaturanGerbang(Object.fromEntries(rows.map((r) => [r.kunci, r.nilai])));
}

export type DataArea = {
  kawasan: AreaGerbang | null;
  /** Semua area aktif berpoligon selain kawasan, terindeks id. */
  area: Map<number, AreaGerbang & { jenis: string }>;
};

/**
 * Poligon yang SUDAH disetujui saja (`areas.polygon`); draf impor tidak dipakai gerbang.
 * Bila ada lebih dari satu kawasan aktif, yang ber-id terkecil dipakai.
 */
export async function dataArea(tx: Pembaca = db): Promise<DataArea> {
  const rows = await tx
    .select({ id: areas.id, nama: areas.nama, jenis: areas.jenis, polygon: areas.polygon, restricted: areas.restricted })
    .from(areas)
    .where(and(eq(areas.aktif, true), isNotNull(areas.polygon)))
    .orderBy(areas.id);
  let kawasan: AreaGerbang | null = null;
  const area = new Map<number, AreaGerbang & { jenis: string }>();
  for (const r of rows) {
    if (r.jenis === "kawasan") {
      kawasan ??= { id: r.id, nama: r.nama, polygon: r.polygon, restricted: r.restricted };
    } else {
      area.set(r.id, { id: r.id, nama: r.nama, polygon: r.polygon, restricted: r.restricted, jenis: r.jenis });
    }
  }
  return { kawasan, area };
}

/**
 * Keputusan gerbang resmi untuk satu aset. Area aset dibaca langsung (juga bila belum
 * berpoligon) supaya tanda area terbatas tetap berlaku.
 */
export async function nilaiGerbangAset(
  tx: Pembaca,
  aset: { areaId: number | null; bergerak: boolean },
  gps: { lat: number; lng: number; accuracy: number } | null,
): Promise<HasilGerbang> {
  const [pengaturan, data, areaAset] = await Promise.all([
    pengaturanGerbang(tx),
    dataArea(tx),
    aset.areaId
      ? tx
          .select({ id: areas.id, nama: areas.nama, polygon: areas.polygon, restricted: areas.restricted, aktif: areas.aktif })
          .from(areas)
          .where(eq(areas.id, aset.areaId))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  return nilaiGerbang({
    posisi: gps ? { lat: gps.lat, lng: gps.lng, akurasi: gps.accuracy } : null,
    areaAset: areaAset ? { ...areaAset, polygon: areaAset.aktif ? areaAset.polygon : null } : null,
    kawasan: data.kawasan,
    bergerak: aset.bergerak,
    pengaturan,
    areaLain: [...data.area.values()],
  });
}

/**
 * Bingkai awal semua peta Leaflet: kotak batas kawasan galangan yang aktif dan disetujui
 * (ber-id terkecil, sama dengan gerbang). Null bila belum ada kawasan disetujui.
 */
export async function bingkaiKawasan(tx: Pembaca = db): Promise<BatasPeta | null> {
  const [k] = await tx
    .select({ polygon: areas.polygon })
    .from(areas)
    .where(and(eq(areas.jenis, "kawasan"), eq(areas.aktif, true), isNotNull(areas.polygon)))
    .orderBy(areas.id)
    .limit(1);
  return k?.polygon ? batasGeometri(k.polygon) : null;
}
