import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assetTypes, checklistGroups, checklistItems } from "@/db/schema";

/** Checklist per tipe objek, urut grup lalu butir (hanya baca). */
export async function checklistPerTipe() {
  return db
    .select({
      tipe: assetTypes.nama,
      tipeId: assetTypes.id,
      grup: checklistGroups.nama,
      grupKode: checklistGroups.kode,
      id: checklistItems.id,
      urut: checklistItems.urut,
      label: checklistItems.label,
      answerType: checklistItems.answerType,
      options: checklistItems.options,
      severityMap: checklistItems.severityMap,
      severityDefault: checklistItems.severityDefault,
      dasarHukum: checklistItems.dasarHukum,
      wajib: checklistItems.wajib,
      aktif: checklistItems.aktif,
    })
    .from(checklistItems)
    .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
    .innerJoin(assetTypes, eq(assetTypes.id, checklistGroups.assetTypeId))
    .orderBy(asc(assetTypes.urut), asc(checklistGroups.urut), asc(checklistItems.urut));
}
