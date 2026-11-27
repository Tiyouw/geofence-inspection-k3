import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { IlustrasiModul, KosongModul, modulDari } from "@/components/ilustrasi/modul";
import { db } from "@/db";
import { alasanGerbangSql, assets, assetTypes, inspections, issues } from "@/db/schema";
import { KARTU } from "@/features/inspeksi/ui/a";
import { LencanaGerbang, LencanaKesimpulan, LencanaModeDemo, LencanaSeverity } from "@/features/inspeksi/ui/lencana";
import { requireRole } from "@/lib/auth/guards";
import { GATE_PERLU_TINJAUAN } from "@/lib/domain/constants";
import { formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Riwayat" };

const PER_HALAMAN = 20;

/** SPEC §3.10: inspeksi final milik sendiri, terbaru dulu, 20 per halaman, dengan temuan. */
export default async function RiwayatPage({ searchParams }: PageProps<"/petugas/riwayat">) {
  const user = await requireRole("inspektur");
  const sp = await searchParams;
  const hal = Math.max(1, Number(sp.hal) || 1);
  const tinjau = sp.tinjau === "1";
  const where = and(
    eq(inspections.userId, user.id),
    eq(inspections.status, "final"),
    tinjau ? inArray(inspections.gateStatus, [...GATE_PERLU_TINJAUAN]) : undefined,
  );
  const [rows, jumlah] = await Promise.all([
    db
      .select({
        id: inspections.id,
        kode: assets.kode,
        lokasi: assets.lokasiTeks,
        slug: assetTypes.slug,
        tipe: assetTypes.nama,
        inspectedAt: inspections.inspectedAt,
        kesimpulan: inspections.kesimpulan,
        gateStatus: inspections.gateStatus,
        gateAlasan: alasanGerbangSql,
        offline: inspections.offline,
        ditinjauPada: inspections.ditinjauPada,
      })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
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
  const tautan = (q: { hal?: number; tinjau?: boolean }) => {
    const p = new URLSearchParams();
    if (q.tinjau) p.set("tinjau", "1");
    if (q.hal && q.hal > 1) p.set("hal", String(q.hal));
    const s = p.toString();
    return `/petugas/riwayat${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Riwayat inspeksi</h1>
        <p className="text-sm text-muted-foreground">{n} inspeksi terkirim</p>
      </div>
      <nav className="flex gap-2" aria-label="Saring riwayat">
        {[
          { label: "Semua", aktif: !tinjau, href: tautan({}) },
          { label: "Perlu tinjauan", aktif: tinjau, href: tautan({ tinjau: true }) },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            aria-current={c.aktif ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold",
              c.aktif ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground",
            )}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className={KARTU}>
          <KosongModul
            modul="apar"
            judul={tinjau ? "Tidak ada inspeksi yang menunggu tinjauan." : "Belum ada inspeksi terkirim."}
            isi="Inspeksi yang sudah diterima peladen tampil di sini."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={cn(KARTU, "space-y-2 p-4")}>
              <div className="flex items-start gap-3">
                <IlustrasiModul modul={modulDari(r.slug ?? r.tipe)} ukuran={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.kode}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.lokasi} · {formatWaktu(r.inspectedAt)}
                    {r.offline ? " · lewat antrean" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {r.kesimpulan && <LencanaKesimpulan k={r.kesimpulan} />}
                  <LencanaGerbang status={r.gateStatus} />
                  {r.gateAlasan === "mode_demo" && <LencanaModeDemo />}
                  {r.ditinjauPada && <span className="text-[11px] text-muted-foreground">sudah ditinjau</span>}
                </div>
              </div>
              {temuan
                .filter((t) => t.inspectionId === r.id)
                .map((t, i) => (
                  <p key={i} className="flex items-start justify-between gap-2 border-t border-border/70 pt-2 text-sm">
                    <span>{t.item}</span>
                    <LencanaSeverity s={t.severity} />
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm font-semibold" aria-label="Halaman">
        {hal > 1 ? (
          <Link href={tautan({ hal: hal - 1, tinjau })} className="inline-flex min-h-11 items-center gap-1">
            <ChevronLeft className="size-4" aria-hidden /> Lebih baru
          </Link>
        ) : (
          <span />
        )}
        {hal * PER_HALAMAN < n ? (
          <Link href={tautan({ hal: hal + 1, tinjau })} className="inline-flex min-h-11 items-center gap-1">
            Lebih lama <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
