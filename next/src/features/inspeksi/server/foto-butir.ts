import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, checklistGroups, checklistItems, inspectionPhotos, inspections, photoStepItems, photoSteps } from "@/db/schema";

export type FotoBukti = { id: string; takenAtDevice: Date | null; uploadedAt: Date; gpsAccuracy: number | null; langkah: string | null };
export type ButirDenganFoto = { id: number; grup: string; label: string; foto: FotoBukti[] };

/**
 * Foto bukti per butir checklist (PRD "Aturan bukti" 3, ADR-8): tautan foto ke butir diturunkan
 * dari langkahnya (`inspection_photos.step_id` → `photo_step_items`). Hanya baca; dipakai halaman
 * detail Admin K3 dan Pemantau, yang sudah memeriksa peran.
 */
export async function fotoPerButir(inspectionId: string): Promise<{
  areaTerbatas: boolean;
  butir: ButirDenganFoto[];
  tanpaLangkah: FotoBukti[];
} | null> {
  const [ins] = await db
    .select({ assetTypeId: assets.assetTypeId, areaTerbatas: inspections.restrictedArea })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .where(eq(inspections.id, inspectionId));
  if (!ins) return null;

  const fotos = await db
    .select({
      id: inspectionPhotos.id,
      takenAtDevice: inspectionPhotos.takenAtDevice,
      uploadedAt: inspectionPhotos.uploadedAt,
      gpsAccuracy: inspectionPhotos.gpsAccuracy,
      stepId: inspectionPhotos.stepId,
      langkah: photoSteps.judul,
    })
    .from(inspectionPhotos)
    .leftJoin(photoSteps, eq(photoSteps.id, inspectionPhotos.stepId))
    .where(eq(inspectionPhotos.inspectionId, inspectionId))
    .orderBy(asc(inspectionPhotos.takenAtDevice), asc(inspectionPhotos.uploadedAt));

  const stepIds = [...new Set(fotos.map((f) => f.stepId).filter((x): x is number => x !== null))];
  const [items, tautan] = await Promise.all([
    db
      .select({ id: checklistItems.id, label: checklistItems.label, grup: checklistGroups.nama, aktif: checklistItems.aktif })
      .from(checklistItems)
      .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
      .where(eq(checklistGroups.assetTypeId, ins.assetTypeId))
      .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut)),
    stepIds.length
      ? db.select().from(photoStepItems).where(inArray(photoStepItems.stepId, stepIds))
      : Promise.resolve([] as { stepId: number; checklistItemId: number }[]),
  ]);

  const tampil = (f: (typeof fotos)[number]): FotoBukti => ({
    id: f.id,
    takenAtDevice: f.takenAtDevice,
    uploadedAt: f.uploadedAt,
    gpsAccuracy: f.gpsAccuracy,
    langkah: f.langkah,
  });
  const fotoButir = new Map<number, FotoBukti[]>();
  for (const f of fotos) {
    if (f.stepId === null) continue;
    for (const t of tautan.filter((x) => x.stepId === f.stepId)) {
      fotoButir.set(t.checklistItemId, [...(fotoButir.get(t.checklistItemId) ?? []), tampil(f)]);
    }
  }
  return {
    areaTerbatas: ins.areaTerbatas,
    // Butir nonaktif tetap tampil bila punya foto (inspeksi lama).
    butir: items
      .filter((i) => i.aktif || fotoButir.has(i.id))
      .map((i) => ({ id: i.id, grup: i.grup, label: i.label, foto: fotoButir.get(i.id) ?? [] })),
    tanpaLangkah: fotos.filter((f) => f.stepId === null).map(tampil),
  };
}
