import "server-only";
import { and, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, divisions, inspections, issues } from "@/db/schema";
import { syaratAntreanTinjauan } from "@/features/tinjauan/server";
import { barisLaporanProgres, namaGedung, type HitunganArea } from "./rakit";
import { progres, type OpsiProgres } from "./server";

/**
 * Bahan laporan "Progres per gedung" (PRD F15). Progres memakai fungsi yang sama dengan dasbor
 * (`progres`), jadi untuk periode berjalan angkanya identik. Hitungan tinjauan dan temuan
 * dibatasi rentang periode setiap modul.
 */
export async function laporanProgresGedung(opsi: OpsiProgres, now = new Date()) {
    const p = await progres(opsi, now);
    const dalamPeriode: SQL | undefined = p.modul.length
        ? or(
              ...p.modul.map((m) =>
                  and(
                      eq(assets.assetTypeId, m.id),
                      gte(inspections.inspectedAt, m.rentang.awal),
                      lt(inspections.inspectedAt, m.rentang.akhir),
                  ),
              ),
          )
        : sql`false`;
    const gedung = sql<string | null>`coalesce(${areas.nama}, ${assets.gedung})`;
    const [tinjauan, temuan, unit] = await Promise.all([
        db
            .select({
                gedung,
                menunggu: sql<number>`count(*) filter (where ${syaratAntreanTinjauan})::int`,
                ditolak: sql<number>`count(*) filter (where ${inspections.hasilTinjauan} = 'ditolak')::int`,
            })
            .from(inspections)
            .innerJoin(assets, eq(assets.id, inspections.assetId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .where(and(eq(inspections.status, "final"), dalamPeriode))
            .groupBy(sql`1`),
        db
            .select({ gedung, n: sql<number>`count(*)::int` })
            .from(issues)
            .innerJoin(inspections, eq(inspections.id, issues.inspectionId))
            .innerJoin(assets, eq(assets.id, issues.assetId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .where(dalamPeriode)
            .groupBy(sql`1`),
        p.modul.some((m) => m.ownerDivisionId)
            ? db
                  .select({ nama: divisions.nama })
                  .from(divisions)
                  .where(inArray(divisions.id, p.modul.map((m) => m.ownerDivisionId).filter((x): x is number => x != null)))
            : [],
    ]);

    const hitungan = new Map<string, HitunganArea>();
    const ambil = (nama: string) => {
        const h = hitungan.get(nama) ?? { perluTinjauan: 0, ditolak: 0, temuan: 0 };
        hitungan.set(nama, h);
        return h;
    };
    for (const r of tinjauan) {
        if (!r.menunggu && !r.ditolak) continue;
        const h = ambil(namaGedung(r.gedung, null));
        h.perluTinjauan += r.menunggu;
        h.ditolak += r.ditolak;
    }
    for (const r of temuan) ambil(namaGedung(r.gedung, null)).temuan += r.n;

    return {
        /** Modul beserta jumlah wajib/diperiksa pada periodenya (sama dengan dasbor). */
        modul: p.perModul,
        unit: unit.map((u) => u.nama),
        ...barisLaporanProgres(p, hitungan),
    };
}

export type LaporanProgresGedung = Awaited<ReturnType<typeof laporanProgresGedung>>;
