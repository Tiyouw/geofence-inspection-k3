import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, checklistGroups, checklistItems, inspections, issues } from "@/db/schema";
import { labelLantai, radiusEfektif } from "@/lib/domain/asset";
import { jatuhTempo, periodeDari, tambahHari, type ButirChecklist } from "@/lib/domain/inspeksi";
import type { Kesimpulan } from "@/lib/domain/constants";
import { hariIniJakarta } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/guards";

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
  media: string | null;
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
  /** Aset yang sudah punya inspeksi final bulan ini (oleh siapa pun). */
  sudahDiperiksa: number[];
  /** Inspeksi final milik sendiri, 30 hari terakhir. */
  terkirim: TerkirimPaket[];
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

  const rows = await db
    .select({ a: assets, t: assetTypes })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(and(eq(assets.aktif, true), eq(assetTypes.aktif, true)))
    .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode));

  const aset: AsetPaket[] = rows.map(({ a, t }) => ({
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
    media: labelMedia(a.attributes ?? null),
    qrTokenHash: createHmac("sha256", key).update(a.qrToken).digest("hex"),
  }));

  const tipeIds = [...new Set(rows.map((r) => r.t.id))];
  const jt: Record<number, string> = {};
  for (const { t } of rows) jt[t.id] = jatuhTempo(mulai, t.periodeHari);

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
      satuan: i.satuan,
      wajib: i.wajib,
      dasarHukum: i.dasarHukum,
      keterangan: i.keterangan,
    });
  }

  const sudah = await db
    .selectDistinct({ assetId: inspections.assetId })
    .from(inspections)
    .where(and(eq(inspections.status, "final"), gte(inspections.inspectedAt, awalBulan)));

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
    .update(JSON.stringify({ a: aset.map((x) => [x.id, x.kode, x.radiusM, x.lat, x.lng]), c: butir.map((b) => [b.i.id, b.i.updatedAt]) }))
    .digest("hex")
    .slice(0, 12);

  return {
    versi,
    serverTime: new Date().toISOString(),
    hmacKey: key.toString("base64"),
    periode: { mulai, hariIni, jatuhTempo: jt },
    aset,
    checklist,
    sudahDiperiksa: sudah.map((s) => s.assetId),
    terkirim: milikSendiri.map((m) => ({ ...m, inspectedAt: m.inspectedAt!.toISOString() })),
  };
}
