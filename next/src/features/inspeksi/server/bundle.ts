import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, assetTypes, checklistGroups, checklistItems, divisions, inspections, issues } from "@/db/schema";
import { bolehInspeksiAset } from "@/lib/domain/akses";
import { labelLantai, radiusEfektif } from "@/lib/domain/asset";
import { periodeDari, tambahHari, type ButirChecklist } from "@/lib/domain/inspeksi";
import { jatuhTempoUntuk, periodeUntuk, rentangPeriode } from "@/lib/domain/jadwal";
import type { Kesimpulan, TipeKotakP3k } from "@/lib/domain/constants";
import type { LangkahFoto } from "@/lib/domain/langkah-foto";
import { bacaTipeKotak } from "@/lib/domain/modul/p3k";
import { hariIniJakarta } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/guards";
import { langkahPerTipe } from "./langkah";

export type AsetPaket = {
  id: number;
  kode: string;
  assetTypeId: number;
  tipe: string;
  gedung: string | null;
  lantai: string | null;
  lokasiTeks: string;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  /** Objek bergerak (mobil pemadam): tanpa gerbang lokasi. Opsional: paket lama di perangkat belum memuatnya. */
  bergerak?: boolean;
  media: string | null;
  /** Kotak P3K: tipe kotak penentu jumlah baku (bawaan A bila atribut kosong); null untuk modul lain. */
  tipeKotak?: TipeKotakP3k | null;
  /** Aset di area terbatas: kamera terpandu dilewati, QR + GPS cukup (PRD Aturan bukti 4). */
  areaTerbatas: boolean;
  /** HMAC-SHA256(kunciPerangkat, token) heksadesimal. Token mentah TIDAK pernah dikirim (SPEC §7.7). */
  qrTokenHash: string;
};

export type GrupPaket = { kode: string | null; nama: string; items: (ButirChecklist & { dasarHukum: string | null; keterangan: string | null })[] };

export type TerkirimPaket = {
  inspectionId: string;
  assetId: number;
  kode: string;
  inspectedAt: string;
  kesimpulan: Kesimpulan | null;
  jumlahTemuan: number;
  gateStatus: string;
};

export type PaketKerja = {
  versi: string;
  serverTime: string;
  /** Kunci HMAC per unduhan, base64. Klien mengimpornya sebagai CryptoKey non-extractable. */
  hmacKey: string;
  periode: { mulai: string; hariIni: string; jatuhTempo: Record<number, string> };
  aset: AsetPaket[];
  checklist: Record<number, GrupPaket[]>;
  /** Kamera terpandu: urutan langkah foto per tipe aset (PRD Aturan bukti 3). */
  langkahFoto: Record<number, LangkahFoto[]>;
  /** Aset yang sudah punya inspeksi final bulan ini (oleh siapa pun). */
  sudahDiperiksa: number[];
  /** Inspeksi final milik sendiri, 30 hari terakhir. */
  terkirim: TerkirimPaket[];
  /** Nama unit kerja inspektur (PRD F2). */
  unit: string | null;
  /**
   * Stiker aset milik unit lain: hanya hash token dan nama unitnya, supaya pemindai dapat
   * menyebut pemilik aset (PRD alur Inspektur langkah 3). Aset ini tidak dapat diinspeksi.
   */
  asetUnitLain: { qrTokenHash: string; unit: string | null }[];
};

function labelMedia(attr: Record<string, unknown> | null): string | null {
  const jenis = (attr?.jenis ?? attr?.tipe) as string | undefined;
  const kg = attr?.kapasitas_kg as number | undefined;
  if (!jenis && !kg) return null;
  return `${jenis ?? "APAR"}${kg ? ` / ${String(kg).replace(".", ",")} kg` : ""}`;
}

/** SPEC §7.3 butir 1: paket kerja inspektur untuk luring. */
export async function paketKerja(user: SessionUser): Promise<PaketKerja> {
  const key = randomBytes(32);
  const hariIni = hariIniJakarta();
  const mulai = periodeDari(hariIni);
  const awalBulan = new Date(`${mulai}T00:00:00+07:00`);

  const semua = await db
    .select({ a: assets, t: assetTypes, unit: divisions.nama, terbatas: areas.restricted })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .leftJoin(divisions, eq(divisions.id, assetTypes.ownerDivisionId))
    .leftJoin(areas, eq(areas.id, assets.areaId))
    .where(and(eq(assets.aktif, true), eq(assetTypes.aktif, true)))
    .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode));
  // Otorisasi unit (PRD F2): paket hanya memuat aset milik unit inspektur.
  const rows = semua.filter((r) => bolehInspeksiAset(user, r.t.ownerDivisionId));
  const asetUnitLain = semua
    .filter((r) => !bolehInspeksiAset(user, r.t.ownerDivisionId))
    .map((r) => ({ qrTokenHash: createHmac("sha256", key).update(r.a.qrToken).digest("hex"), unit: r.unit }));
  const [unitSendiri] = user.divisionId
    ? await db.select({ nama: divisions.nama }).from(divisions).where(eq(divisions.id, user.divisionId))
    : [];

  const aset: AsetPaket[] = rows.map(({ a, t, terbatas }) => ({
    id: a.id,
    kode: a.kode,
    assetTypeId: a.assetTypeId,
    tipe: t.nama,
    gedung: a.gedung,
    lantai: labelLantai(a.lantai),
    lokasiTeks: a.lokasiTeks,
    lat: a.lat,
    lng: a.lng,
    radiusM: t.isMobile ? null : radiusEfektif({ radiusAset: a.radiusM, lokasiTipe: a.lokasiTipe }),
    bergerak: t.isMobile,
    media: labelMedia(a.attributes ?? null),
    tipeKotak: t.slug === "p3k" ? (bacaTipeKotak(a.attributes) ?? "A") : null,
    areaTerbatas: terbatas === true,
    qrTokenHash: createHmac("sha256", key).update(a.qrToken).digest("hex"),
  }));

  const tipeIds = [...new Set(rows.map((r) => r.t.id))];
  // Jatuh tempo dan awal periode per tipe aset: minggu berjalan untuk mobil pemadam, bulan untuk lainnya.
  const jt: Record<number, string> = {};
  const awalPeriode = new Map<number, Date>();
  for (const { t } of rows) {
    const p = periodeUntuk(hariIni, t.periodeHari);
    jt[t.id] = jatuhTempoUntuk(p, t.periodeHari);
    awalPeriode.set(t.id, rentangPeriode(p, t.periodeHari).awal);
  }
  const awalTerlama = new Date(Math.min(awalBulan.getTime(), ...[...awalPeriode.values()].map((d) => d.getTime())));

  const butir = tipeIds.length
    ? await db
        .select({ g: checklistGroups, i: checklistItems })
        .from(checklistItems)
        .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
        .where(and(inArray(checklistGroups.assetTypeId, tipeIds), eq(checklistItems.aktif, true)))
        .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut))
    : [];
  const checklist: Record<number, GrupPaket[]> = {};
  for (const { g, i } of butir) {
    const list = (checklist[g.assetTypeId] ??= []);
    let grup = list.find((x) => x.nama === g.nama && x.kode === g.kode);
    if (!grup) list.push((grup = { kode: g.kode, nama: g.nama, items: [] }));
    grup.items.push({
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
      dasarHukum: i.dasarHukum,
      keterangan: i.keterangan,
    });
  }

  const langkahFoto: Record<number, LangkahFoto[]> = Object.fromEntries(await langkahPerTipe(db, tipeIds));

  const terakhir = await db
    .select({ assetId: inspections.assetId, t: sql<Date>`max(${inspections.inspectedAt})`.mapWith(inspections.inspectedAt) })
    .from(inspections)
    .where(and(eq(inspections.status, "final"), gte(inspections.inspectedAt, awalTerlama)))
    .groupBy(inspections.assetId);
  const tipePerAset = new Map(rows.map(({ a }) => [a.id, a.assetTypeId]));
  const sudah = terakhir.filter((r) => {
    const awal = awalPeriode.get(tipePerAset.get(r.assetId) ?? -1) ?? awalBulan;
    return r.t != null && r.t >= awal;
  });

  const batasTerkirim = new Date(`${tambahHari(hariIni, -30)}T00:00:00+07:00`);
  const milikSendiri = await db
    .select({
      inspectionId: inspections.id,
      assetId: inspections.assetId,
      kode: assets.kode,
      inspectedAt: inspections.inspectedAt,
      kesimpulan: inspections.kesimpulan,
      gateStatus: inspections.gateStatus,
      jumlahTemuan: sql<number>`(select count(*)::int from ${issues} where ${issues.inspectionId} = ${inspections.id})`,
    })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .where(
      and(
        eq(inspections.userId, user.id),
        eq(inspections.status, "final"),
        gte(inspections.inspectedAt, batasTerkirim),
        lt(inspections.inspectedAt, new Date(Date.now() + 86_400_000)),
      ),
    )
    .orderBy(desc(inspections.inspectedAt))
    .limit(100);

  const versi = createHmac("sha256", "versi")
    .update(JSON.stringify({ a: aset.map((x) => [x.id, x.kode, x.radiusM, x.lat, x.lng, x.areaTerbatas]), c: butir.map((b) => [b.i.id, b.i.updatedAt]), l: langkahFoto }))
    .digest("hex")
    .slice(0, 12);

  return {
    versi,
    serverTime: new Date().toISOString(),
    hmacKey: key.toString("base64"),
    periode: { mulai, hariIni, jatuhTempo: jt },
    aset,
    checklist,
    langkahFoto,
    sudahDiperiksa: sudah.map((s) => s.assetId),
    unit: unitSendiri?.nama ?? null,
    asetUnitLain,
    terkirim: milikSendiri.map((m) => ({ ...m, inspectedAt: m.inspectedAt!.toISOString() })),
  };
}
