import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ubahPeriodeTipe } from "@/features/admin/actions/jadwal";
import { DialogAksi } from "@/features/admin/components/dialog-aksi";
import { Kartu, Kosong, Lencana, Pilihan, Tabel } from "@/features/admin/components/ui";
import { labelJadwal } from "@/features/admin/lib/label";
import { mundurBulan, parsePeriode, periodeJakarta } from "@/features/admin/lib/periode";
import { daftarTipe, jadwalPeriode } from "@/features/admin/server/jadwal";
import { requireRole } from "@/lib/auth/guards";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatTanggal, formatWaktu, hariIniJakarta } from "@/lib/format";

export const metadata: Metadata = { title: "Jadwal" };

const tgl = (d: string) => formatTanggal(`${d}T00:00:00+07:00`, { dateStyle: "medium" });

/** Jadwal kewajiban per periode (SPEC §3.9, G10). Hanya membaca; periode per tipe dapat diubah. */
export default async function Jadwal({ searchParams }: PageProps<"/admin/jadwal">) {
  await requireRole("admin");
  const sp = await searchParams;
  const p = parsePeriode(typeof sp.periode === "string" ? sp.periode : undefined) ?? periodeJakarta();
  const tipeSlug = typeof sp.tipe === "string" && sp.tipe ? sp.tipe : "apar";
  const [rows, tipe] = await Promise.all([jadwalPeriode(p, tipeSlug), daftarTipe()]);
  const hariIni = hariIniJakarta();
  const label = rows.map((r) => labelJadwal(r.status, r.jatuhTempo, hariIni));
  const hitung = label.reduce<Record<string, number>>((a, l) => ((a[l.label] = (a[l.label] ?? 0) + 1), a), {});
  const pilihanBulan = Array.from({ length: 13 }, (_, i) => mundurBulan(periodeJakarta(), i));

  return (
    <>
      <PageHeader title="Jadwal" description="Kewajiban inspeksi per aset per periode. Status: Belum, Terlewat, Terlaksana, Terlaksana (telat)." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" aria-label="Pilih periode">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Periode
              <Pilihan name="periode" defaultValue={p.tanggal.slice(0, 7)}>
                {pilihanBulan.map((b) => (
                  <option key={b.tanggal} value={b.tanggal.slice(0, 7)}>
                    {formatTanggal(b.awal, { month: "long", year: "numeric" })}
                  </option>
                ))}
              </Pilihan>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Tipe objek
              <Pilihan name="tipe" defaultValue={tipeSlug}>
                {tipe.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.nama}
                  </option>
                ))}
              </Pilihan>
            </label>
            <Button type="submit">Tampilkan</Button>
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              {Object.entries(hitung).map(([k, n]) => (
                <Lencana key={k}>
                  {k}: {n}
                </Lencana>
              ))}
            </div>
          </form>
          {rows.length === 0 ? (
            <Kosong>Tidak ada aset aktif untuk tipe ini.</Kosong>
          ) : (
            <Tabel>
              <thead>
                <tr>
                  <th>Aset</th>
                  <th>Lokasi</th>
                  <th>Jatuh tempo</th>
                  <th>Status</th>
                  <th>Diperiksa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.asetId}>
                    <td className="font-medium">
                      <Link href={`/admin/aset/${r.asetId}`} className="hover:underline">
                        {r.kode}
                      </Link>
                    </td>
                    <td>{labelLokasi(r)}</td>
                    <td className="whitespace-nowrap">
                      {tgl(r.jatuhTempo)}
                      {!r.adaBaris && <span className="block text-xs text-muted-foreground">turunan (belum ada baris jadwal)</span>}
                    </td>
                    <td>
                      <Lencana nada={label[i]!.nada}>{label[i]!.label}</Lencana>
                    </td>
                    <td className="whitespace-nowrap">
                      {r.inspectionId ? (
                        <Link href={`/admin/tinjauan/${r.inspectionId}`} className="hover:underline">
                          {formatWaktu(r.inspectedAt)} · {r.inspektur}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </div>
        <Kartu judul="Periode inspeksi per tipe">
          <ul className="divide-y text-sm">
            {tipe.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {t.nama}
                  <span className="block text-xs text-muted-foreground">
                    tiap {t.periodeHari} hari · {t.jumlahAset} aset aktif
                  </span>
                </span>
                <DialogAksi judul={`Periode inspeksi ${t.nama}`} deskripsi="Berlaku untuk jadwal yang dibuat sesudahnya. APAR mengikuti NFPA 10 (30 hari)." pemicu="Ubah" ukuranPemicu="xs" aksi={ubahPeriodeTipe} tersembunyi={{ id: t.id }}>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Periode (hari)
                    <Input name="periodeHari" type="number" min={1} max={366} defaultValue={t.periodeHari} required />
                  </label>
                </DialogAksi>
              </li>
            ))}
          </ul>
        </Kartu>
      </div>
    </>
  );
}
