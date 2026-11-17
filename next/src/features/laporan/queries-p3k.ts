import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, checklistGroups, checklistItems, inspectionAnswers, inspections, users } from "@/db/schema";
import { bacaTipeKotak, butirIsiDari } from "@/lib/domain/modul/p3k";
import { hariIniJakarta } from "@/lib/format";
import { rentangBulan, type FilterPeriode } from "./queries";
import { rakitRekapP3k, type InspeksiP3k } from "./rekap-p3k";

/** Data rekap isi P3K untuk satu bulan (PRD "Laporan": Rekap isi P3K, filter periode dan gedung). */
export async function ambilRekapP3k(f: Pick<FilterPeriode, "tahun" | "bulan" | "gedung">) {
  const [tipe] = await db.select().from(assetTypes).where(eq(assetTypes.slug, "p3k")).limit(1);
  if (!tipe) return null;
  const { awal, akhir } = rentangBulan(f.tahun, f.bulan);

  const kotak = await db
    .select({ id: assets.id, kode: assets.kode, gedung: assets.gedung, lantai: assets.lantai, lokasiTeks: assets.lokasiTeks, attributes: assets.attributes })
    .from(assets)
    .where(and(eq(assets.assetTypeId, tipe.id), eq(assets.aktif, true), f.gedung ? eq(assets.gedung, f.gedung) : undefined));

  const butir = await db
    .select({
      id: checklistItems.id,
      label: checklistItems.label,
      answerType: checklistItems.answerType,
      jumlahBakuPerTipe: checklistItems.jumlahBakuPerTipe,
      hasExpiry: checklistItems.hasExpiry,
      satuan: checklistItems.satuan,
      severityDefault: checklistItems.severityDefault,
    })
    .from(checklistItems)
    .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
    .where(and(eq(checklistGroups.assetTypeId, tipe.id), eq(checklistItems.aktif, true)))
    .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut));

  const idKotak = kotak.map((k) => k.id);
  const ins = idKotak.length
    ? await db
        .select({ id: inspections.id, assetId: inspections.assetId, inspectedAt: inspections.inspectedAt, kesimpulan: inspections.kesimpulan, petugas: users.name })
        .from(inspections)
        .innerJoin(users, eq(users.id, inspections.userId))
        .where(and(inArray(inspections.assetId, idKotak), eq(inspections.status, "final"), gte(inspections.inspectedAt, awal), lt(inspections.inspectedAt, akhir)))
    : [];
  const jawaban = ins.length
    ? await db
        .select({
          inspectionId: inspectionAnswers.inspectionId,
          checklistItemId: inspectionAnswers.checklistItemId,
          nilaiAngka: inspectionAnswers.nilaiAngka,
          kondisiIsi: inspectionAnswers.kondisiIsi,
          tglKedaluwarsaTerdekat: inspectionAnswers.tglKedaluwarsaTerdekat,
        })
        .from(inspectionAnswers)
        .where(inArray(inspectionAnswers.inspectionId, ins.map((i) => i.id)))
    : [];
  const per = Map.groupBy(jawaban, (j) => j.inspectionId);

  return rakitRekapP3k({
    kotak: kotak.map((k) => ({ ...k, tipeKotak: bacaTipeKotak(k.attributes) })),
    butir: butirIsiDari(butir),
    inspeksi: ins.map(
      (i): InspeksiP3k => ({
        assetId: i.assetId,
        inspectedAt: i.inspectedAt!,
        tanggal: hariIniJakarta(i.inspectedAt!),
        kesimpulan: i.kesimpulan,
        petugas: i.petugas,
        jawaban: per.get(i.id) ?? [],
      }),
    ),
  });
}
