import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { db as Db } from "@/db";
import { assetTypes, checklistGroups, checklistItems, photoStepItems, photoSteps } from "@/db/schema";
import { langkahCadangan, lengkapiLangkah, type LangkahFoto } from "@/lib/domain/langkah-foto";

type Kueri = Pick<typeof Db, "select">;

/**
 * Langkah kamera terpandu per tipe aset (ADR-8), dari `photo_steps` yang aktif. Tipe tanpa
 * langkah memakai cadangan satu langkah per grup checklist; butir aktif yang belum terpetakan
 * dikumpulkan ke "Butir lainnya", supaya setiap butir punya bukti foto.
 */
export async function langkahPerTipe(q: Kueri, tipeIds: number[]): Promise<Map<number, LangkahFoto[]>> {
  const out = new Map<number, LangkahFoto[]>();
  if (!tipeIds.length) return out;
  const [butir, langkah] = await Promise.all([
    q
      .select({ tipe: checklistGroups.assetTypeId, kode: checklistGroups.kode, nama: checklistGroups.nama, id: checklistItems.id })
      .from(checklistItems)
      .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
      .where(and(inArray(checklistGroups.assetTypeId, tipeIds), eq(checklistItems.aktif, true)))
      .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut)),
    q
      .select({ s: photoSteps, itemId: photoStepItems.checklistItemId })
      .from(photoSteps)
      .innerJoin(assetTypes, eq(assetTypes.id, photoSteps.assetTypeId))
      .leftJoin(photoStepItems, eq(photoStepItems.stepId, photoSteps.id))
      .where(and(inArray(photoSteps.assetTypeId, tipeIds), eq(photoSteps.aktif, true)))
      .orderBy(asc(photoSteps.urut)),
  ]);

  for (const tipe of tipeIds) {
    const items = butir.filter((b) => b.tipe === tipe);
    const aktif = new Set(items.map((b) => b.id));
    const dariDb: LangkahFoto[] = [];
    for (const { s, itemId } of langkah.filter((l) => l.s.assetTypeId === tipe)) {
      let l = dariDb.find((x) => x.id === s.id);
      if (!l) dariDb.push((l = { id: s.id, kode: s.kode ?? `langkah-${s.id}`, judul: s.judul, petunjuk: s.petunjuk, itemIds: [] }));
      if (itemId !== null && aktif.has(itemId)) l.itemIds.push(itemId);
    }
    // Butir per langkah mengikuti urutan checklist (gabungan tabel tidak menjamin urutan).
    const posisi = new Map(items.map((b, i) => [b.id, i]));
    for (const l of dariDb) l.itemIds.sort((x, y) => posisi.get(x)! - posisi.get(y)!);
    const terpakai = dariDb.filter((l) => l.itemIds.length > 0);
    if (terpakai.length) {
      out.set(tipe, lengkapiLangkah(terpakai, [...aktif]));
    } else {
      const grup: { kode: string | null; nama: string; items: { id: number }[] }[] = [];
      for (const b of items) {
        let g = grup.find((x) => x.kode === b.kode && x.nama === b.nama);
        if (!g) grup.push((g = { kode: b.kode, nama: b.nama, items: [] }));
        g.items.push({ id: b.id });
      }
      out.set(tipe, langkahCadangan(grup));
    }
  }
  return out;
}

export async function langkahTipeAset(q: Kueri, assetTypeId: number): Promise<LangkahFoto[]> {
  return (await langkahPerTipe(q, [assetTypeId])).get(assetTypeId) ?? [];
}
