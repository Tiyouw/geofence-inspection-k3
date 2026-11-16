import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, IdCard } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { NAMA_BULAN, persen1, tanggalIso } from "@/features/laporan/format";
import { pengingatTerakhir } from "@/features/laporan/jadwal";
import { ambilPapanPantau } from "@/features/laporan/queries";
import { labelLokasi, lewatTenggat, narasiPemantau, sisaHariBulan, urutRisiko } from "@/features/laporan/rakit";
import { Bilah, Lencana } from "@/features/laporan/ui";
import { labelLantai } from "@/lib/domain/asset";
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
 * Ringkasan untuk manajemen (SPEC §5, ACCEPTANCE J1-J4). Hanya baca: tidak ada
 * antrean keputusan dan tidak ada tombol tulis. Admin tidak melihat ringkasan ini
 * (dasbornya sendiri di /admin).
 */
export default async function PemantauHome() {
  const user = await requireRole("admin", "pemantau");
  if (user.role === "admin") return <PapanAdmin />;

  const now = new Date();
  const p = await ambilPapanPantau(now);
  const total = p.aset.length;
  const diperiksa = p.kondisiPer.size;
  const persen = total ? Math.round((diperiksa / total) * 1000) / 10 : 0;
  const tidakLayak = [...p.kondisiPer.values()].filter((k) => k === "tidak_layak").length;
  const berat = p.temuanTerbuka.filter((t) => t.severity === "berat").length;
  const lewat = p.temuanTerbuka.filter((t) => lewatTenggat(t, p.hariIni)).length;
  const hari = sisaHariBulan(now);
  const narasi = narasiPemantau({ total, diperiksa, persen, tidakLayak, berat, lewat, posisi: p.posisi, hari }, persen1);
  const risiko = urutRisiko(p.temuanTerbuka, p.hariIni);
  const bulan = NAMA_BULAN[p.periode.bulan - 1]!;

  const area = new Map<string, { sudah: number; total: number }>();
  for (const a of p.aset) {
    const nama = [a.gedung || "Area belum diisi", labelLantai(a.lantai)].filter(Boolean).join(" · ");
    const v = area.get(nama) ?? { sudah: 0, total: 0 };
    v.total++;
    if (p.kondisiPer.has(a.id)) v.sudah++;
    area.set(nama, v);
  }
  const maksTren = Math.max(1, ...p.tren.map((t) => t.jumlah));
  const pengingat = await pengingatTerakhir(db);
  const dataPengingat = pengingat?.data as { terlewat?: number; segera?: number } | undefined;

  return (
    <>
      <PageHeader
        title="Papan pantau"
        description={`Halo, ${user.name}. ${formatTanggal(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Periode ${bulan} ${p.periode.tahun} · Akses hanya baca`}
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
            <dl className="grid grid-cols-3 gap-3">
              {[
                [`${persen1(persen)}%`, "kepatuhan"],
                [String(tidakLayak), "unit tidak layak"],
                [String(lewat), "temuan lewat tenggat"],
              ].map(([angka, label]) => (
                <div key={label} className="rounded-lg bg-muted/60 p-3">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{angka}</dd>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Risiko terbuka</h3>
              {risiko.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada temuan terbuka.</p>
              ) : (
                <ul className="divide-y rounded-lg border" data-testid="risiko">
                  {risiko.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 p-3">
                      <span className="mt-0.5 rounded-md bg-danger-soft px-2 py-1 text-xs font-bold text-danger">{r.kode}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span>
                            {r.kode} · {labelLokasi(r)}
                          </span>
                          {r.tanda.map((t) => (
                            <Lencana key={t} nada={t === "Berat" ? "bahaya" : t === "Lewat tenggat" ? "bahaya" : "waspada"}>
                              {t}
                            </Lencana>
                          ))}
                        </p>
                        <p className="text-sm text-muted-foreground">{r.item}</p>
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
                      Matriks ✓ X O Ø · {bulan} {p.periode.tahun}
                    </p>
                  </div>
                  <a
                    href="/laporan/pms"
                    target="_blank"
                    rel="noopener"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    <Download className="size-4" aria-hidden /> Unduh PDF
                  </a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-4" aria-hidden /> Rekap temuan
                    </p>
                    <p className="text-xs text-muted-foreground">{risiko.length ? "Temuan yang belum selesai, dengan foto bukti" : "Belum ada temuan terbuka"}</p>
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
                    <p className="text-xs text-muted-foreground">Pengganti kartu gantung, {total} unit</p>
                  </div>
                  <Link href="/pemantau/laporan#kartu" className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    Pilih unit
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card aria-labelledby="judul-kepatuhan">
            <CardHeader>
              <CardTitle id="judul-kepatuhan">Kepatuhan {bulan}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold tabular-nums">{persen1(persen)}%</p>
              <p className="mb-4 text-sm text-muted-foreground">
                {diperiksa} dari {total} unit · sisa {hari} hari
              </p>
              <div className="space-y-3">
                {area.size === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada APAR aktif.</p>
                ) : (
                  [...area.entries()].map(([nama, v]) => <Bilah key={nama} label={nama} nilai={v.sudah} total={v.total} />)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2" aria-labelledby="judul-tren">
          <CardHeader>
            <CardTitle id="judul-tren">Tren 6 bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex h-40 items-end gap-3" aria-label="Jumlah unit yang diinspeksi per bulan">
              {p.tren.map((t) => (
                <li key={t.label} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium tabular-nums">{t.jumlah}</span>
                  <span className="w-full rounded-t-md bg-chart-1/80" style={{ height: `${(t.jumlah / maksTren) * 110}px` }} />
                  <span className="text-xs text-muted-foreground">{t.label}</span>
                </li>
              ))}
            </ol>
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
      </div>
    </>
  );
}
