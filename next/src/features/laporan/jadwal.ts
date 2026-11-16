import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { assetTypes, assets, auditLogs, inspections, issues, schedules } from "@/db/schema";
import { jatuhTempo, periodeDari, sisaHari, statusSetelahInspeksi } from "@/lib/domain/jadwal";
import { tanggalIso } from "./format";
import { rentangBulan } from "./queries";

/** Tenggat yang dianggap "segera" untuk pengingat. */
export const HARI_PENGINGAT = 3;

function periodeSebelumnya(periode: string): string {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export type HasilCron = {
  hariIni: string;
  periode: string;
  jadwalBaru: Record<string, number>;
  ditautkan: number;
  terlewat: number;
  segera: { kode: string; jatuhTempo: string; sisa: number }[];
  temuanLewatTenggat: number;
};

/**
 * Pekerjaan harian (Vercel Cron, Hobby: sekali sehari). Idempoten, aman diulang:
 *
 * 1. Jadwal awal periode (SPEC §3.9 celah, §9 #6; ACCEPTANCE G14): satu baris per aset
 *    aktif per bulan, untuk bulan ini dan bulan lalu (bila cron sempat terlewat), sehingga
 *    bulan tanpa inspeksi tetap tercatat sebagai "Terlewat".
 * 2. Menautkan jadwal `belum` dengan inspeksi final pada periodenya bila finalisasi belum
 *    menandainya (mis. kiriman antrean luring), status selesai/telat dari tanggal inspeksi.
 * 3. Pengingat: jadwal belum yang jatuh tempo ≤ HARI_PENGINGAT hari, yang terlewat, dan
 *    temuan lewat tenggat, dicatat di audit_logs (aksi `cron.jadwal`) dan dikembalikan.
 *
 * Tidak pernah mengubah inspeksi, temuan, atau jadwal yang sudah selesai/telat.
 */
export async function jalankanCronJadwal(db: Db, now = new Date()): Promise<HasilCron> {
  const hariIni = tanggalIso(now);
  const periode = periodeDari(hariIni);
  const daftarPeriode = [periodeSebelumnya(periode), periode];

  return db.transaction(async (tx) => {
    const jadwalBaru: Record<string, number> = {};
    for (const p of daftarPeriode) {
      const [y, m] = p.split("-").map(Number) as [number, number];
      const { akhir } = rentangBulan(y, m);
      const aset = await tx
        .select({ id: assets.id, periodeHari: assetTypes.periodeHari })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        // Aset yang baru dibuat setelah periode itu berakhir tidak punya kewajiban di periode itu.
        .where(and(eq(assets.aktif, true), eq(assetTypes.aktif, true), lt(assets.createdAt, akhir)));
      if (!aset.length) {
        jadwalBaru[p] = 0;
        continue;
      }
      const baru = await tx
        .insert(schedules)
        .values(aset.map((a) => ({ assetId: a.id, periode: p, jatuhTempo: jatuhTempo(p, a.periodeHari), status: "belum" as const })))
        .onConflictDoNothing({ target: [schedules.assetId, schedules.periode] })
        .returning({ id: schedules.id });
      jadwalBaru[p] = baru.length;
    }

    // 2. Tautkan jadwal yang masih "belum" dengan inspeksi final terakhir di periodenya.
    let ditautkan = 0;
    for (const p of daftarPeriode) {
      const [y, m] = p.split("-").map(Number) as [number, number];
      const { awal, akhir } = rentangBulan(y, m);
      const belum = await tx
        .select({ id: schedules.id, assetId: schedules.assetId, jatuhTempo: schedules.jatuhTempo })
        .from(schedules)
        .where(and(eq(schedules.periode, p), eq(schedules.status, "belum")));
      if (!belum.length) continue;
      const terakhir = await tx
        .selectDistinctOn([inspections.assetId], { assetId: inspections.assetId, id: inspections.id, inspectedAt: inspections.inspectedAt })
        .from(inspections)
        .where(
          and(
            inArray(inspections.assetId, belum.map((b) => b.assetId)),
            eq(inspections.status, "final"),
            gte(inspections.inspectedAt, awal),
            lt(inspections.inspectedAt, akhir),
          ),
        )
        .orderBy(inspections.assetId, sql`${inspections.inspectedAt} desc`);
      const per = new Map(terakhir.map((t) => [t.assetId, t]));
      for (const j of belum) {
        const ins = per.get(j.assetId);
        if (!ins?.inspectedAt) continue;
        await tx
          .update(schedules)
          .set({ inspectionId: ins.id, status: statusSetelahInspeksi(tanggalIso(ins.inspectedAt), j.jatuhTempo) })
          .where(and(eq(schedules.id, j.id), eq(schedules.status, "belum")));
        ditautkan++;
      }
    }

    // 3. Pengingat.
    const tertunda = await tx
      .select({ kode: assets.kode, jatuhTempo: schedules.jatuhTempo })
      .from(schedules)
      .innerJoin(assets, eq(assets.id, schedules.assetId))
      .where(and(eq(schedules.status, "belum"), eq(assets.aktif, true)))
      .orderBy(asc(schedules.jatuhTempo), asc(assets.kode));
    const terlewat = tertunda.filter((t) => t.jatuhTempo < hariIni).length;
    const segera = tertunda
      .map((t) => ({ ...t, sisa: sisaHari(hariIni, t.jatuhTempo) }))
      .filter((t) => t.sisa >= 0 && t.sisa <= HARI_PENGINGAT);
    const [lewat] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(issues)
      .where(and(sql`${issues.status} <> 'selesai'`, lt(issues.targetSelesai, hariIni)));

    const hasil: HasilCron = {
      hariIni,
      periode,
      jadwalBaru,
      ditautkan,
      terlewat,
      segera,
      temuanLewatTenggat: lewat?.n ?? 0,
    };
    await tx.insert(auditLogs).values({
      aksi: "cron.jadwal",
      entitas: "schedules",
      entitasId: periode,
      data: { ...hasil, segera: hasil.segera.length, contohSegera: hasil.segera.slice(0, 20) },
    });
    return hasil;
  });
}

/** Ringkasan pengingat terakhir untuk papan pantau (tanpa menulis apa pun). */
export async function pengingatTerakhir(db: Db) {
  const [row] = await db
    .select({ data: auditLogs.data, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.aksi, "cron.jadwal"))
    .orderBy(sql`${auditLogs.createdAt} desc`)
    .limit(1);
  return row ?? null;
}
