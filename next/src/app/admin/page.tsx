import type { Metadata } from "next";
import { and, eq, inArray, sql } from "drizzle-orm";
import { PageHeader } from "@/components/shell/app-shell";
import { StatCard } from "@/components/shell/stat-card";
import { db } from "@/db";
import { assets, inspections, issues } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { GATE_PERLU_TINJAUAN } from "@/lib/domain/constants";
import { formatAngka } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

/** Stub: ringkasan admin. Diisi sesi Admin. */
export default async function AdminHome() {
  await requireRole("admin");
  const [[aset], [tinjauan], [temuan]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(assets).where(eq(assets.aktif, true)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(inspections)
      .where(and(eq(inspections.status, "final"), inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN), sql`${inspections.ditinjauPada} is null`)),
    db.select({ n: sql<number>`count(*)::int` }).from(issues).where(inArray(issues.status, ["terbuka", "proses"])),
  ]);

  return (
    <>
      <PageHeader title="Ringkasan" description="Kelola data induk, jadwal, dan tinjauan inspeksi." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Aset aktif" value={formatAngka(aset?.n)} />
        <StatCard label="Perlu ditinjau" value={formatAngka(tinjauan?.n)} tone="warning" hint="Gerbang GPS tidak sesuai" />
        <StatCard label="Temuan terbuka" value={formatAngka(temuan?.n)} tone="danger" />
      </div>
    </>
  );
}
