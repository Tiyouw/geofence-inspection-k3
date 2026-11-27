import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { assetTypes, assets, auditLogs, inspections, schedules } from "@/db/schema";
import {
  jatuhTempoUntuk,
  periodeDari,
  periodeSebelum,
  periodeUntuk,
  rentangPeriode,
  sisaHari,
  statusSetelahInspeksi,
} from "@/lib/domain/jadwal";
import { tanggalIso } from "./format";

/** Tenggat yang dianggap "segera" untuk pengingat. */
export const HARI_PENGINGAT = 3;

export type HasilCron = {
  hariIni: string;
  /** Periode bulan berjalan (tipe bulanan). */
  periode: string;
  /** Jadwal baru per periode ("YYYY-MM-01" bulanan, Senin untuk mingguan). */
  jadwalBaru: Record<string, number>;
  ditautkan: number;
  terlewat: number;
  segera: { kode: string; jatuhTempo: string; sisa: number }[];
};

/**
 * Pekerjaan harian (Vercel Cron, Hobby: sekali sehari). Idempoten, aman diulang:
 *
 * 1. Jadwal awal periode (SPEC §3.9 celah, §9 #6; ACCEPTANCE G14): satu baris per aset
 *    aktif per periode tipe asetnya (bulan; minggu Senin-Minggu untuk mobil pemadam, PRD F16),
 *    untuk periode ini dan periode sebelumnya (bila cron sempat terlewat), sehingga periode
 *    tanpa inspeksi tetap tercatat sebagai "Terlewat".
 * 2. Menautkan jadwal `belum` dengan inspeksi final pada periodenya bila finalisasi belum
 *    menandainya (mis. kiriman antrean luring), status selesai/telat dari tanggal inspeksi.
 * 3. Pengingat: jadwal belum yang jatuh tempo ≤ HARI_PENGINGAT hari dan yang terlewat,
 *    dicatat di audit_logs (aksi `cron.jadwal`) dan dikembalikan. Temuan tidak punya tenggat
 *    (ADR-4), jadi tidak ada pengingat temuan.
 *
 * Tidak pernah mengubah inspeksi, temuan, atau jadwal yang sudah selesai/telat.
 */
export async function jalankanCronJadwal(db: Db, now = new Date()): Promise<HasilCron> {
  const hariIni = tanggalIso(now);

  return db.transaction(async (tx) => {
    const tipe = await tx
      .select({ id: assetTypes.id, periodeHari: assetTypes.periodeHari })
      .from(assetTypes)
      .where(eq(assetTypes.aktif, true));

    // Satu kelompok per (periode, periode_hari): tipe dengan aturan periode yang sama digabung.
    const kelompok = new Map<string, { periode: string; periodeHari: number; tipeIds: number[] }>();
    for (const t of tipe) {
      const kini = periodeUntuk(hariIni, t.periodeHari);
      for (const p of [periodeSebelum(kini, t.periodeHari), kini]) {
        const k = `${p}:${t.periodeHari}`;
        const g = kelompok.get(k) ?? { periode: p, periodeHari: t.periodeHari, tipeIds: [] };
        g.tipeIds.push(t.id);
        kelompok.set(k, g);
      }
    }

    const jadwalBaru: Record<string, number> = {};
    let ditautkan = 0;
    for (const g of kelompok.values()) {
      const { awal, akhir } = rentangPeriode(g.periode, g.periodeHari);
      const aset = await tx
        .select({ id: assets.id })
        .from(assets)
        // Aset yang baru dibuat setelah periode itu berakhir tidak punya kewajiban di periode itu.
        .where(and(eq(assets.aktif, true), inArray(assets.assetTypeId, g.tipeIds), lt(assets.createdAt, akhir)));
      jadwalBaru[g.periode] ??= 0;
      if (aset.length) {
        const tempo = jatuhTempoUntuk(g.periode, g.periodeHari);
        const baru = await tx
          .insert(schedules)
          .values(aset.map((a) => ({ assetId: a.id, periode: g.periode, jatuhTempo: tempo, status: "belum" as const })))
          .onConflictDoNothing({ target: [schedules.assetId, schedules.periode] })
          .returning({ id: schedules.id });
        jadwalBaru[g.periode] += baru.length;
      }

      // 2. Tautkan jadwal yang masih "belum" dengan inspeksi final terakhir di periodenya.
      const belum = await tx
        .select({ id: schedules.id, assetId: schedules.assetId, jatuhTempo: schedules.jatuhTempo })
        .from(schedules)
        .innerJoin(assets, eq(assets.id, schedules.assetId))
        .where(and(eq(schedules.periode, g.periode), eq(schedules.status, "belum"), inArray(assets.assetTypeId, g.tipeIds)));
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

    const periode = periodeDari(hariIni);
    const hasil: HasilCron = { hariIni, periode, jadwalBaru, ditautkan, terlewat, segera };
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
