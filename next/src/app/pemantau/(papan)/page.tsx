import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, IdCard } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { periodeJakarta } from "@/features/admin/lib/periode";
import { progresSemuaModul, temuanSejak } from "@/features/dasbor/server";
import { NAMA_BULAN, persen1, tanggalIso } from "@/features/laporan/format";
import { pengingatTerakhir } from "@/features/laporan/jadwal";
import { narasiPemantau } from "@/features/laporan/rakit";
import { Bilah, Lencana } from "@/features/laporan/ui";
import { daftarTemuan } from "@/features/temuan/server";
import { hitungTinjauan } from "@/features/tinjauan/server";
import { requireRole } from "@/lib/auth/guards";
import { formatTanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Papan pantau" };

/**
 * Admin tidak melihat ringkasan manajemen (ACCEPTANCE J1, RedesainPanelTest): antrean
 * keputusannya ada di /admin. Halaman ini hanya menunjuk ke tampilan baca dan laporan.
 */
function PapanAdmin() {
  return (
    <>
      <PageHeader title="Papan pantau" description="Ringkasan manajemen ditujukan untuk Pemantau. Antrean keputusan Admin K3 ada di dasbor admin." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["/admin", "Dasbor admin"],
          ["/pemantau/tinjauan", "Antrean tinjauan"],
          ["/pemantau/inspeksi", "Inspeksi dan foto bukti"],
          ["/pemantau/temuan", "Temuan"],
          ["/pemantau/laporan", "Laporan bulanan (PDF)"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link href={href!} className="block rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Ringkasan untuk manajemen lintas empat modul (PRD F14): progres per modul pada periodenya,
 * per gedung, temuan berat bulan ini, dan antrean tinjauan. Admin melihat dasbornya di /admin.
 */
export default async function PemantauHome() {
  const user = await requireRole("admin", "pemantau");
  if (user.role === "admin") return <PapanAdmin />;

  const now = new Date();
  const p = periodeJakarta(now);
  const [progres, temuan, tinjauan, berat, pengingat] = await Promise.all([
    progresSemuaModul(now),
    temuanSejak(p.awal),
    hitungTinjauan(p.awal),
    daftarTemuan({ tingkat: "berat", dari: tanggalIso(p.awal) }, 1),
    pengingatTerakhir(db),
  ]);
  const narasi = narasiPemantau(
    {
      total: progres.total,
      diperiksa: progres.sudah,
      persen: progres.persen,
      tidakLayak: progres.kondisi.tidak_layak,
      berat: temuan.berat,
      tinjauan: tinjauan.menunggu,
      perModul: progres.perModul,
    },
    persen1,
  );
  const bulan = NAMA_BULAN[p.bulan - 1]!;
  const dataPengingat = pengingat?.data as { terlewat?: number; segera?: number } | undefined;
  const risiko = berat.rows.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Papan pantau"
        description={`Halo, ${user.name}. ${formatTanggal(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Periode ${bulan} ${p.tahun}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="judul-ringkasan">
          <CardHeader>
            <CardTitle id="judul-ringkasan">Ringkasan untuk manajemen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p data-testid="narasi" className="leading-relaxed">
              {narasi}
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [`${persen1(progres.persen)}%`, "kepatuhan semua modul"],
                [String(progres.kondisi.tidak_layak), "unit tidak layak"],
                [String(temuan.berat), "temuan berat bulan ini"],
                [String(tinjauan.menunggu), "menunggu tinjauan"],
              ].map(([angka, label]) => (
                <div key={label} className="rounded-lg bg-muted/60 p-3">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{angka}</dd>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Temuan berat bulan ini</h3>
              {risiko.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada temuan berat bulan ini.</p>
              ) : (
                <ul className="divide-y rounded-lg border" data-testid="risiko">
                  {risiko.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 p-3">
                      <span className="mt-0.5 rounded-md bg-danger-soft px-2 py-1 text-xs font-bold text-danger">{r.asetKode}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <Link href={`/pemantau/temuan/${r.id}`} className="underline-offset-4 hover:underline">
                            {r.item}
                          </Link>
                          <Lencana nada="bahaya">Berat</Lencana>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {r.modul} · {r.lokasi}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/pemantau/temuan" className="mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline">
                Lihat semua temuan
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card aria-labelledby="judul-tinjauan">
            <CardHeader>
              <CardTitle id="judul-tinjauan">Tinjauan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-4xl font-semibold tabular-nums" data-testid="jumlah-tinjauan">
                {tinjauan.menunggu}
              </p>
              <p className="text-muted-foreground">
                inspeksi menunggu tinjauan · {tinjauan.gpsLemah} GPS lemah · {tinjauan.areaTerbatas} area terbatas
              </p>
              <p className="text-muted-foreground">
                Bulan ini: {tinjauan.diterima} diterima, {tinjauan.ditolak} ditolak
              </p>
              <Link
                href="/pemantau/tinjauan"
                className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground transition-colors duration-200 hover:bg-brand-hover"
              >
                Buka antrean
              </Link>
            </CardContent>
          </Card>

          <Card aria-labelledby="judul-lap">
            <CardHeader>
              <CardTitle id="judul-lap">Laporan siap cetak</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-4" aria-hidden /> Laporan PMS bulanan
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Per modul · {bulan} {p.tahun}
                    </p>
                  </div>
                  <Link href="/pemantau/laporan" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    <Download className="size-4" aria-hidden /> Pilih
                  </Link>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-4" aria-hidden /> Rekap temuan
                    </p>
                    <p className="text-xs text-muted-foreground">Semua modul bulan ini, dengan foto bukti</p>
                  </div>
                  <a href="/laporan/temuan" target="_blank" rel="noopener" className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    Unduh
                  </a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <IdCard className="size-4" aria-hidden /> Kartu kontrol per unit
                    </p>
                    <p className="text-xs text-muted-foreground">Pengganti kartu gantung, {progres.total} unit</p>
                  </div>
                  <Link href="/pemantau/laporan#kartu" className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    Pilih unit
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2" aria-labelledby="judul-modul">
          <CardHeader>
            <CardTitle id="judul-modul">Progres per modul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-testid="progres-modul">
            {progres.perModul.map((m) => (
              <Bilah
                key={m.slug}
                label={`${m.nama} · ${m.mingguan ? "minggu ini" : "bulan ini"}`}
                nilai={m.sudah}
                total={m.total}
              />
            ))}
          </CardContent>
        </Card>

        <Card aria-labelledby="judul-jadwal">
          <CardHeader>
            <CardTitle id="judul-jadwal">Pengingat jadwal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {pengingat ? (
              <>
                <p>
                  <span className="font-semibold tabular-nums">{dataPengingat?.terlewat ?? 0}</span> jadwal terlewat ·{" "}
                  <span className="font-semibold tabular-nums">{dataPengingat?.segera ?? 0}</span> jatuh tempo dalam 3 hari
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Diperbarui otomatis setiap hari, terakhir {formatTanggal(pengingat.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB.</p>
              </>
            ) : (
              <p className="text-muted-foreground">Jadwal harian belum pernah berjalan ({tanggalIso(now)}).</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3" aria-labelledby="judul-gedung">
          <CardHeader>
            <CardTitle id="judul-gedung">Progres per gedung</CardTitle>
          </CardHeader>
          <CardContent>
            {progres.perArea.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada aset aktif.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="progres-gedung">
                {progres.perArea.map((a) => (
                  <li key={a.nama} className="space-y-2">
                    <Bilah label={a.nama} nilai={a.sudah} total={a.total} />
                    <p className="text-xs text-muted-foreground">{a.modul.map((m) => `${m.nama} ${m.sudah}/${m.total}`).join(" · ")}</p>
                    {a.belum.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Belum dicek ({a.belum.length})</summary>
                        <p className="mt-1">{a.belum.map((b) => b.kode).join(", ")}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
