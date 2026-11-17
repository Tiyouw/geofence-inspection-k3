/**
 * Pemuat checklist generik untuk semua modul (mobil pemadam, P3K, hydrant). Definisi butir
 * berupa data murni di src/lib/domain/modul/*; berkas ini hanya menulisnya ke basis data.
 *
 * Idempoten: grup dikunci pada (tipe aset, kode), butir pada (grup, urut), bukan label,
 * karena label bisa direvisi sedangkan urut adalah kunci seed yang stabil.
 */
import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import * as s from "../schema";
import type { AnswerType, Severity, TindakanRekomendasi } from "../../lib/domain/constants";

type Db = ReturnType<typeof drizzle<typeof s>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ItemSeed = {
    /** Urut global per tipe aset; bila kosong, diberi nomor berurutan. */
    urut?: number;
    label: string;
    answerType: AnswerType;
    options?: string[];
    severityMap?: Record<string, Severity>;
    severityDefault: Severity;
    dasarHukum: string;
    keterangan?: string;
    satuan?: string;
    /** Jumlah baku per tipe kotak P3K (PRD), kolom checklist_items.jumlah_baku_per_tipe. */
    jumlahBaku?: { A: number; B: number; C: number };
    hasExpiry?: boolean;
    tindakanBawaan?: TindakanRekomendasi;
    wajib?: boolean;
};

export type GrupSeed = { kode: string; nama: string; items: ItemSeed[] };

function kolomItem(item: ItemSeed) {
    return {
        label: item.label,
        answerType: item.answerType,
        options: item.options ?? null,
        severityMap: item.severityMap ?? null,
        severityDefault: item.severityDefault,
        satuan: item.satuan ?? null,
        dasarHukum: item.dasarHukum,
        keterangan: item.keterangan ?? null,
        jumlahBakuPerTipe: item.jumlahBaku ?? null,
        hasExpiry: item.hasExpiry ?? false,
        tindakanBawaan: item.tindakanBawaan ?? null,
        wajib: item.wajib ?? true,
        aktif: true,
    };
}

export async function seedChecklist(tx: Tx, assetTypeId: number, grup: GrupSeed[]): Promise<number> {
    let urut = 0;
    let jumlah = 0;
    for (const [gi, g] of grup.entries()) {
        let [group] = await tx
            .select()
            .from(s.checklistGroups)
            .where(and(eq(s.checklistGroups.assetTypeId, assetTypeId), eq(s.checklistGroups.kode, g.kode)));
        if (group) {
            await tx
                .update(s.checklistGroups)
                .set({ nama: g.nama, urut: gi + 1 })
                .where(eq(s.checklistGroups.id, group.id));
        } else {
            [group] = await tx
                .insert(s.checklistGroups)
                .values({ assetTypeId, kode: g.kode, nama: g.nama, urut: gi + 1 })
                .returning();
        }
        for (const item of g.items) {
            urut = item.urut ?? urut + 1;
            const values = kolomItem(item);
            const [ada] = await tx
                .select({ id: s.checklistItems.id })
                .from(s.checklistItems)
                .where(and(eq(s.checklistItems.checklistGroupId, group!.id), eq(s.checklistItems.urut, urut)));
            if (ada) await tx.update(s.checklistItems).set(values).where(eq(s.checklistItems.id, ada.id));
            else await tx.insert(s.checklistItems).values({ ...values, checklistGroupId: group!.id, urut });
            jumlah++;
        }
    }
    return jumlah;
}
