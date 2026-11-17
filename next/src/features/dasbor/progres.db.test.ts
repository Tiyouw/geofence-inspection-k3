/**
 * Laporan "Progres per gedung" (periode berjalan) harus sama persis dengan angka dasbor
 * (PRD F14/F15). Uji integrasi terhadap Postgres uji; dilewati bila DATABASE_URL tidak ada.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("progres per gedung = dasbor (integrasi)", async () => {
    const { laporanProgresGedung } = await import("./laporan");
    const { progresSemuaModul, progres } = await import("./server");

    it("periode berjalan: per gedung, per modul, dan jumlah sama dengan dasbor", async () => {
        const now = new Date();
        const [dasbor, laporan] = await Promise.all([progresSemuaModul(now), laporanProgresGedung({}, now)]);
        const ringkas = (a: { nama: string; total: number; sudah: number; modul: { slug: string; total: number; sudah: number }[] }) => [
            a.nama,
            a.total,
            a.sudah,
            a.modul.map((m) => [m.slug, m.total, m.sudah]),
        ];
        expect(laporan.baris.filter((b) => b.total > 0).map(ringkas)).toEqual(dasbor.perArea.map(ringkas));
        expect(laporan.total).toMatchObject({ total: dasbor.total, sudah: dasbor.sudah, persen: dasbor.persen });
        expect(laporan.modul.map((m) => [m.slug, m.total, m.sudah])).toEqual(dasbor.perModul.map((m) => [m.slug, m.total, m.sudah]));
    });

    it("per bulan: mobil pemadam dihitung per minggu, modul bulanan sekali", async () => {
        const bulan = new Date().toISOString().slice(0, 8) + "01";
        const p = await progres({ bulan });
        for (const m of p.modul) {
            const asetModul = new Set(p.aset.filter((a) => a.modulSlug === m.slug).map((a) => a.asetId));
            expect(p.aset.filter((a) => a.modulSlug === m.slug)).toHaveLength(asetModul.size * m.daftarPeriode.length);
            if (m.mingguan) expect(m.daftarPeriode.length).toBeGreaterThanOrEqual(4);
            else expect(m.daftarPeriode).toHaveLength(1);
        }
    });
});
