import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shell/stat-card";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { formatAngka, formatTanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Beranda petugas" };

/** Stub: beranda inspektur. Diisi sesi Inspektur PWA. */
export default async function PetugasHome() {
  const user = await requireRole("inspektur");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schedules)
    .where(
      and(
        eq(schedules.petugasId, user.id),
        eq(schedules.status, "belum"),
        eq(schedules.periode, sql`date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date`),
      ),
    );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{formatTanggal(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {user.name.split(" ")[0]}</h1>
      </div>
      <StatCard label="Belum diperiksa bulan ini" value={formatAngka(row?.n)} tone="warning" />
      <Button asChild variant="brand" size="lg" className="h-14 w-full text-base">
        <Link href="/petugas/pindai">
          <QrCode className="size-5" aria-hidden /> Pindai QR APAR
        </Link>
      </Button>
    </div>
  );
}
