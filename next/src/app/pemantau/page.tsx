import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/shell/app-shell";
import { StatCard } from "@/components/shell/stat-card";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { formatAngka, formatTanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Papan pantau" };

/** Stub: papan pantau. Diisi sesi Laporan/Pemantau. */
export default async function PemantauHome() {
  await requireRole("admin", "pemantau");
  const rows = await db
    .select({ status: schedules.status, n: sql<number>`count(*)::int` })
    .from(schedules)
    .where(eq(schedules.periode, sql`date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date`))
    .groupBy(schedules.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const total = rows.reduce((a, r) => a + r.n, 0);
  const selesai = by.selesai ?? 0;

  return (
    <>
      <PageHeader title="Papan pantau" description={`Kepatuhan inspeksi bulan ${formatTanggal(new Date(), { month: "long", year: "numeric" })}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Kepatuhan" value={total ? `${Math.round((selesai / total) * 100)}%` : "-"} tone="success" />
        <StatCard label="Sudah diperiksa" value={formatAngka(selesai)} hint={`dari ${formatAngka(total)} jadwal`} />
        <StatCard label="Belum / telat" value={formatAngka((by.belum ?? 0) + (by.telat ?? 0))} tone="warning" />
      </div>
    </>
  );
}
