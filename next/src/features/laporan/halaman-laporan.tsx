import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatCard } from "@/components/shell/stat-card";
import { NAMA_BULAN, namaPeriode, persen1, tglDmy } from "@/features/laporan/format";
import { bacaFilter } from "@/features/laporan/http";
import { ambilDataPeriode, daftarGedung, daftarTipe, tahunTersedia } from "@/features/laporan/queries";
import { perluTinjauan } from "@/features/laporan/rakit";
import { Kosong, LencanaGerbang, LencanaKesimpulan, Tabel } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";
import { Pilihan } from "@/components/ui/pilihan";

const pilih = "h-9 min-w-40";

/**
 * Laporan bulanan (SPEC §4.9, ACCEPTANCE L6): saring tipe/tahun/bulan/gedung, ringkasan,
 * unduhan PDF (PMS, rekap temuan, progres per gedung), dan rincian per unit dengan tautan kartu kontrol.
 */
export async function HalamanLaporan({ q }: { q: Record<string, string | string[] | undefined> }) {
  await requireRole("admin", "pemantau");
  const f = bacaFilter(q) ?? bacaFilter({})!;
  const [tipe, gedung, tahun, data] = await Promise.all([daftarTipe(), daftarGedung(), tahunTersedia(), ambilDataPeriode(f)]);
  const query = new URLSearchParams({ tipe: f.tipe, tahun: String(f.tahun), bulan: String(f.bulan), ...(f.gedung ? { gedung: f.gedung } : {}) });
  const temuanPer = new Map<number, number>();
  for (const t of data?.temuan ?? []) temuanPer.set(t.assetId, (temuanPer.get(t.assetId) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Laporan bulanan"
        description={`Lembar PMS, rekap temuan, dan kartu kontrol · ${namaPeriode(f.tahun, f.bulan)}${f.gedung ? ` · Gedung ${f.gedung}` : ""}`}
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" aria-label="Saring laporan">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Tipe objek</span>
          <Pilihan name="tipe" defaultValue={f.tipe} className={pilih}>
            {tipe.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.nama}
              </option>
            ))}
          </Pilihan>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Tahun</span>
          <Pilihan name="tahun" defaultValue={String(f.tahun)} className={pilih}>
            {[...new Set([f.tahun, ...tahun])].sort((a, b) => b - a).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Pilihan>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Bulan</span>
          <Pilihan name="bulan" defaultValue={String(f.bulan)} className={pilih}>
            {NAMA_BULAN.map((b, i) => (
              <option key={b} value={i + 1}>
                {b}
              </option>
            ))}
          </Pilihan>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Gedung</span>
          <Pilihan name="gedung" defaultValue={f.gedung ?? ""} className={pilih}>
            <option value="">Semua gedung</option>
            {gedung.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Pilihan>
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Tampilkan
        </button>
      </form>

      {!data ? (
        <Kosong>Tipe objek tidak dikenal.</Kosong>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <a
              href={`/laporan/pms?${query}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
            >
              <Download className="size-4" aria-hidden /> Lembar PMS (PDF)
            </a>
            <a href={`/laporan/temuan?${query}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="size-4" aria-hidden /> Rekap temuan + foto (PDF)
            </a>
            <a href={`/laporan/temuan?${query}&foto=0`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
              Rekap temuan tanpa foto
            </a>
            {f.tipe === "p3k" && (
              <a href={`/laporan/isi-p3k?${query}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                <Download className="size-4" aria-hidden /> Rekap isi P3K (PDF)
              </a>
            )}
          </div>

          <section aria-labelledby="judul-progres" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3" data-testid="unduh-progres">
            <h2 id="judul-progres" className="mr-1 text-sm font-medium">
              Progres per gedung, semua modul:
            </h2>
            <a
              href={`/laporan/progres?tahun=${f.tahun}&bulan=${f.bulan}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            >
              <Download className="size-4" aria-hidden /> {namaPeriode(f.tahun, f.bulan)} (PDF)
            </a>
            <a
              href="/laporan/progres"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            >
              <Download className="size-4" aria-hidden /> Periode berjalan, sama dengan dasbor (PDF)
            </a>
          </section>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Kepatuhan" value={`${persen1(data.ringkas.kepatuhan)}%`} hint={`${data.ringkas.diperiksa} diperiksa, ${data.ringkas.belum} belum`} tone="success" />
            <StatCard
              label="Hasil pemeriksaan"
              value={`${data.ringkas.layak} · ${data.ringkas.layakCatatan} · ${data.ringkas.tidakLayak}`}
              hint="Layak · dengan catatan · tidak layak"
            />
            <StatCard label="Temuan berat terbuka" value={data.ringkas.beratTerbuka} tone="danger" hint={`${data.temuan.length} temuan belum selesai`} />
            <StatCard label="Perlu tinjauan" value={data.ringkas.perluTinjauan} hint="Catatan posisi belum ditinjau Admin K3" />
          </div>

          <section id="kartu" aria-labelledby="judul-rincian">
            <h2 id="judul-rincian" className="mb-3 text-lg font-semibold">
              Rincian per unit ({data.ringkas.total})
            </h2>
            {data.baris.length === 0 ? (
              <Kosong>Belum ada unit untuk saringan ini.</Kosong>
            ) : (
              <Tabel label="Rincian per unit">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Lokasi</th>
                    <th>Tanggal periksa</th>
                    <th>Petugas</th>
                    <th>Kesimpulan</th>
                    <th>Temuan terbuka</th>
                    <th>Bukti posisi</th>
                    <th>Kartu kontrol</th>
                  </tr>
                </thead>
                <tbody>
                  {data.baris.map((b) => (
                    <tr key={b.aset.id} className={b.inspeksi ? undefined : "bg-muted/50 italic"}>
                      <td className="font-semibold">{b.aset.kode}</td>
                      <td data-label="Lokasi">
                        {b.lokasi.utama}
                        {b.lokasi.lantai && <span className="ml-1 text-xs text-muted-foreground">({b.lokasi.lantai})</span>}
                      </td>
                      <td data-label="Tanggal periksa" className="tabular-nums">
                        {b.inspeksi ? (
                          <Link href={`/pemantau/inspeksi/${b.inspeksi.id}`} className="underline-offset-4 hover:underline">
                            {tglDmy(b.inspeksi.inspectedAt)}
                          </Link>
                        ) : (
                          "Belum diperiksa"
                        )}
                      </td>
                      <td data-label="Petugas">{b.inspeksi?.petugas ?? "-"}</td>
                      <td data-label="Kesimpulan">{b.inspeksi ? <LencanaKesimpulan k={b.inspeksi.kesimpulan} /> : "-"}</td>
                      <td data-label="Temuan terbuka" className="tabular-nums">{temuanPer.get(b.aset.id) ?? 0}</td>
                      <td data-label="Bukti posisi">
                        {b.inspeksi ? (
                          <span className="inline-flex items-center gap-1">
                            <LencanaGerbang status={b.inspeksi.gateStatus} />
                            {perluTinjauan(b.inspeksi) && <span className="text-xs text-warning">belum ditinjau</span>}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td data-label="Kartu kontrol">
                        <a href={`/laporan/kartu/${b.aset.id}?tahun=${f.tahun}`} target="_blank" rel="noopener" className="font-medium underline-offset-4 hover:underline">
                          PDF {f.tahun}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabel>
            )}
          </section>
        </>
      )}
    </>
  );
}
