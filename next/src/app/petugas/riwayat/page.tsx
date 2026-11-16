import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { assets, inspections, issues } from "@/db/schema";
import { LencanaGerbang, LencanaKesimpulan, LencanaSeverity } from "@/features/inspeksi/ui/lencana";
import { requireRole } from "@/lib/auth/guards";
import { formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Riwayat" };

const PER_HALAMAN = 20;

/** SPEC §3.10: inspeksi final milik sendiri, terbaru dulu, 20 per halaman, dengan temuan. */
export default async function RiwayatPage({ searchParams }: PageProps<"/petugas/riwayat">) {
  const user = await requireRole("inspektur");
  const hal = Math.max(1, Number((await searchParams).hal) || 1);
  const where = and(eq(inspections.userId, user.id), eq(inspections.status, "final"));
  const [rows, jumlah] = await Promise.all([
    db
      .select({
        id: inspections.id,
        kode: assets.kode,
        lokasi: assets.lokasiTeks,
        inspectedAt: inspections.inspectedAt,
        kesimpulan: inspections.kesimpulan,
        gateStatus: inspections.gateStatus,
        offline: inspections.offline,
      })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .where(where)
      .orderBy(desc(inspections.inspectedAt))
      .limit(PER_HALAMAN)
      .offset((hal - 1) * PER_HALAMAN),
    db.select({ n: sql<number>`count(*)::int` }).from(inspections).where(where),
  ]);
  const n = jumlah[0]?.n ?? 0;
  const temuan = rows.length
    ? await db
        .select({ inspectionId: issues.inspectionId, item: issues.item, severity: issues.severity })
        .from(issues)
        .where(inArray(issues.inspectionId, rows.map((r) => r.id)))
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Riwayat inspeksi</h1>
        <p className="text-sm text-muted-foreground">{n} inspeksi terkirim</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Belum ada inspeksi terkirim.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.kode}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.lokasi} · {formatWaktu(r.inspectedAt)}
                    {r.offline ? " · lewat antrean" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {r.kesimpulan && <LencanaKesimpulan k={r.kesimpulan} />}
                  <LencanaGerbang status={r.gateStatus} />
                </div>
              </div>
              {temuan.filter((t) => t.inspectionId === r.id).map((t, i) => (
                <p key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span>{t.item}</span>
                  <LencanaSeverity s={t.severity} />
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm" aria-label="Halaman">
        {hal > 1 ? <Link href={`/petugas/riwayat?hal=${hal - 1}`}>← Lebih baru</Link> : <span />}
        {hal * PER_HALAMAN < n ? <Link href={`/petugas/riwayat?hal=${hal + 1}`}>Lebih lama →</Link> : <span />}
      </nav>
    </div>
  );
}
