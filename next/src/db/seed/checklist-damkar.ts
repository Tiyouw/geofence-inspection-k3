/**
 * Seed modul Mobil Pemadam: checklist 17 butir dan dua kendaraan contoh.
 * Definisi butir di src/lib/domain/modul/damkar.ts (seluruhnya asumsi, lihat berkas itu).
 * Langkah foto (LANGKAH_FOTO_DAMKAR) ditulis oleh seeder langkah foto generik sesi C.
 */
import { eq } from "drizzle-orm";
import * as s from "../schema";
import { buatTokenQr } from "../../lib/domain/asset";
import { CHECKLIST_DAMKAR, SLUG_DAMKAR, type AtributDamkar } from "../../lib/domain/modul/damkar";
import { seedChecklist, type GrupSeed, type Tx } from "./checklist";

export const GRUP_DAMKAR: GrupSeed[] = CHECKLIST_DAMKAR.map((g) => ({
    kode: g.kode,
    nama: g.nama,
    items: g.items.map(({ tindakan, ...item }) => ({ ...item, tindakanBawaan: tindakan })),
}));

/** Kendaraan contoh (nomor fiktif). Aset asli menunggu data perusahaan (PRD 6.1). */
const CONTOH: { kode: string; lokasiTeks: string; attributes: AtributDamkar }[] = [
    {
        kode: "PMK-01",
        lokasiTeks: "Pos pemadam utama",
        attributes: {
            nomor_lambung: "PMK-01",
            nopol: "L 9101 XA",
            kapasitas_tangki_l: 4000,
            kapasitas_pompa_lpm: 2000,
        },
    },
    {
        kode: "PMK-02",
        lokasiTeks: "Pos pemadam dermaga",
        attributes: {
            nomor_lambung: "PMK-02",
            nopol: "L 9102 XA",
            kapasitas_tangki_l: 3000,
            kapasitas_pompa_lpm: 1900,
        },
    },
];

export async function seedDamkar(tx: Tx, divisionId: number | null): Promise<void> {
    const [tipe] = await tx.select().from(s.assetTypes).where(eq(s.assetTypes.slug, SLUG_DAMKAR));
    if (!tipe) throw new Error(`Tipe aset ${SLUG_DAMKAR} belum ada.`);
    const butir = await seedChecklist(tx, tipe.id, GRUP_DAMKAR);
    for (const k of CONTOH) {
        const values = {
            assetTypeId: tipe.id,
            divisionId,
            kode: k.kode,
            gedung: null,
            lantai: null,
            lokasiTeks: k.lokasiTeks,
            lokasiTipe: "kendaraan" as const,
            lat: null,
            lng: null,
            radiusM: null,
            attributes: k.attributes,
            aktif: true,
        };
        await tx
            .insert(s.assets)
            .values({ ...values, qrToken: buatTokenQr() })
            .onConflictDoUpdate({ target: [s.assets.assetTypeId, s.assets.kode], set: values });
    }
    console.log(`Mobil pemadam: ${butir} butir checklist, ${CONTOH.length} kendaraan contoh`);
}
