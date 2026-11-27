import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { waktuDmyHm } from "@/features/laporan/format";
import { daftarInspeksi, hitungTabInspeksi, PER_HALAMAN, TAB_INSPEKSI, type TabInspeksi } from "@/features/laporan/queries";
import { labelLokasi } from "@/features/laporan/rakit";
import { Halaman, Kosong, LencanaGerbang, LencanaKesimpulan, TabTautan, Tabel } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";
import { DURASI_WAJAR_DETIK } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Inspeksi" };

const LABEL_TAB: Record<TabInspeksi, string> = {
  antre: "Antre ditinjau",
  menyimpang: "Lokasi menyimpang",
  tidak_layak: "Tidak layak pakai",
  semua: "Semua",
};

/** Daftar inspeksi final, hanya lihat (SPEC §4.6 untuk pemantau, ACCEPTANCE B6/E7). */
export default async function DaftarInspeksiPage({ searchParams }: PageProps<"/pemantau/inspeksi">) {
  await requireRole("admin", "pemantau");
  const q = await searchParams;
  const jumlah = await hitungTabInspeksi();
  const tabQ = typeof q.tab === "string" && (TAB_INSPEKSI as readonly string[]).includes(q.tab) ? (q.tab as TabInspeksi) : null;
  // Bawaan: antrean tinjauan bila ada isinya, selain itu semua (SPEC §4.6).
  const tab: TabInspeksi = tabQ ?? (jumlah.antre > 0 ? "antre" : "semua");
  const halaman = Math.max(1, Number(q.halaman) || 1);
  const rows = await daftarInspeksi(tab, halaman);

  return (
    <>
      <PageHeader title="Inspeksi" description="Bukti lapangan setiap pemeriksaan yang sudah dikirim. Hanya lihat." />
      <TabTautan tabs={TAB_INSPEKSI.map((t) => ({ href: `/pemantau/inspeksi?tab=${t}`, label: LABEL_TAB[t], jumlah: jumlah[t], aktif: t === tab }))} />
      {rows.length === 0 ? (
        <Kosong>Tidak ada inspeksi pada tab ini.</Kosong>
      ) : (
        <Tabel label="Daftar inspeksi">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Aset</th>
              <th>Inspektur</th>
              <th>Gerbang</th>
              <th>Jarak</th>
              <th>Kesimpulan</th>
              <th>Durasi</th>
              <th>Foto</th>
              <th>Ditinjau</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="whitespace-nowrap tabular-nums">
                  <Link href={`/pemantau/inspeksi/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.inspectedAt ? waktuDmyHm(r.inspectedAt) : "-"}
                  </Link>
                  {r.offline && <span className="ml-1 text-xs text-muted-foreground">(luring)</span>}
                </td>
                <td data-label="Aset">
                  <span className="font-semibold">{r.kode}</span>
                  <span className="block text-xs text-muted-foreground">{labelLokasi(r)}</span>
                </td>
                <td data-label="Inspektur">
                  {r.petugas}
                  {r.qrVerified && <span className="block text-xs text-muted-foreground">QR ✓</span>}
                </td>
                <td data-label="Gerbang">
                  <LencanaGerbang status={r.gateStatus} />
                </td>
                <td data-label="Jarak" className="whitespace-nowrap tabular-nums">
                  {r.jarakM != null ? `${r.jarakM} m` : "-"}
                  {r.gpsAccuracy != null && <span className="block text-xs text-muted-foreground">±{r.gpsAccuracy} m</span>}
                </td>
                <td data-label="Kesimpulan">
                  <LencanaKesimpulan k={r.kesimpulan} />
                </td>
                <td data-label="Durasi" className={r.durasiDetik != null && r.durasiDetik < DURASI_WAJAR_DETIK ? "font-semibold text-danger tabular-nums" : "tabular-nums"}>
                  {r.durasiDetik != null ? `${r.durasiDetik} dtk` : "-"}
                </td>
                <td data-label="Foto" className="tabular-nums">{r.jumlahFoto}</td>
                <td data-label="Ditinjau" title={r.catatanReview ?? undefined}>{r.ditinjauPada ? waktuDmyHm(r.ditinjauPada) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
      <Halaman dasar={`/pemantau/inspeksi?tab=${tab}`} halaman={halaman} total={jumlah[tab]} per={PER_HALAMAN} />
    </>
  );
}
