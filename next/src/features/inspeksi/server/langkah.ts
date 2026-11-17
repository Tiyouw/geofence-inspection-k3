import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { db as Db } from "@/db";
import { checklistGroups, checklistItems } from "@/db/schema";
import { LANGKAH_FOTO_APAR, langkahUntukTipe, type DefinisiLangkahFoto, type LangkahFoto } from "@/lib/domain/langkah-foto";

/**
 * Definisi langkah foto per slug tipe aset. Modul checklist lain (P3K, hydrant, mobil pemadam)
 * menambah barisnya di sini. Setelah tabel `photo_steps` ada, sumbernya pindah ke basis data
 * (diatur Admin) dan peta ini menjadi isi seed.
 */
export const DEFINISI_LANGKAH: Record<string, DefinisiLangkahFoto[]> = {
  apar: LANGKAH_FOTO_APAR,
};

export type GrupDenganUrut = { kode: string | null; nama: string; items: { id: number; urut: number }[] };

export function langkahFotoTipe(slug: string, grup: GrupDenganUrut[]): LangkahFoto[] {
  return langkahUntukTipe(DEFINISI_LANGKAH[slug], grup);
}

type Kueri = Pick<typeof Db, "select">;

/** Langkah foto satu tipe aset, dari butir aktifnya (dipakai unggah foto dan finalisasi). */
export async function langkahTipeAset(q: Kueri, tipe: { id: number; slug: string }): Promise<LangkahFoto[]> {
  const rows = await q
    .select({ g: checklistGroups, i: { id: checklistItems.id, urut: checklistItems.urut } })
    .from(checklistItems)
    .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
    .where(and(eq(checklistGroups.assetTypeId, tipe.id), eq(checklistItems.aktif, true)))
    .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut));
  const grup: GrupDenganUrut[] = [];
  for (const { g, i } of rows) {
    let x = grup.find((y) => y.nama === g.nama && y.kode === g.kode);
    if (!x) grup.push((x = { kode: g.kode, nama: g.nama, items: [] }));
    x.items.push(i);
  }
  return langkahFotoTipe(tipe.slug, grup);
}
