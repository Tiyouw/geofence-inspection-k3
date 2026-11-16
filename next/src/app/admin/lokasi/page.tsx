import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Peta, type TitikTampil } from "@/features/admin/components/peta";
import { Kartu, Pilihan } from "@/features/admin/components/ui";
import { labelRadius } from "@/features/admin/lib/label";
import { asetUntukPeta, pilihanAset } from "@/features/admin/server/aset";
import { requireRole } from "@/lib/auth/guards";
import { labelLokasi, namaArea } from "@/lib/domain/label-aset";

export const metadata: Metadata = { title: "Lokasi" };

/** Peta semua aset (Leaflet + OSM), dikelompokkan per area. Tanpa token. */
export default async function Lokasi({ searchParams }: PageProps<"/admin/lokasi">) {
  await requireRole("admin");
  const sp = await searchParams;
  const gedung = typeof sp.gedung === "string" && sp.gedung ? sp.gedung : undefined;
  const tipe = typeof sp.tipe === "string" && sp.tipe ? sp.tipe : undefined;
  const [aset, pilihan] = await Promise.all([asetUntukPeta({ gedung, tipe }), pilihanAset()]);
  const titik: TitikTampil[] = aset
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({
      id: a.id,
      lat: a.lat!,
      lng: a.lng!,
      judul: a.kode,
      rincian: `${a.tipe} · ${labelLokasi(a)} · radius ${labelRadius(a.radiusM, a.lokasiTipe)}${a.aktif ? "" : " · nonaktif"}`,
      warna: a.aktif ? "chart-3" : "muted-foreground",
      href: `/admin/aset/${a.id}`,
    }));
  const area = new Map<string, { total: number; tanpaTitik: number }>();
  for (const a of aset) {
    const n = namaArea(a);
    const v = area.get(n) ?? { total: 0, tanpaTitik: 0 };
    v.total++;
    if (a.lat == null || a.lng == null) v.tanpaTitik++;
    area.set(n, v);
  }
  const tanpa = aset.length - titik.length;

  return (
    <>
      <PageHeader title="Lokasi" description="Titik aset di peta. Klik titik untuk membuka asetnya; ubah titik dari formulir aset." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" aria-label="Saring peta">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Gedung
          <Pilihan name="gedung" defaultValue={gedung ?? ""}>
            <option value="">Semua</option>
            {pilihan.gedung.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Pilihan>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Tipe objek
          <Pilihan name="tipe" defaultValue={tipe ?? ""}>
            <option value="">Semua</option>
            {pilihan.tipe.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.nama}
              </option>
            ))}
          </Pilihan>
        </label>
        <Button type="submit">Terapkan</Button>
        {tanpa > 0 && (
          <Link href="/admin/aset?tanpa_koordinat=1" className="ml-auto text-sm underline">
            {tanpa} aset tanpa koordinat
          </Link>
        )}
      </form>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Kartu judul={`${titik.length} titik`}>
          <Peta titik={titik} tinggi={560} label="Peta lokasi semua aset" />
        </Kartu>
        <Kartu judul="Area">
          <ul className="space-y-2 text-sm">
            {[...area.entries()].map(([n, v]) => (
              <li key={n} className="flex justify-between gap-2">
                <span>{n}</span>
                <span className="text-muted-foreground tabular-nums">
                  {v.total}
                  {v.tanpaTitik > 0 && ` (${v.tanpaTitik} tanpa titik)`}
                </span>
              </li>
            ))}
          </ul>
        </Kartu>
      </div>
    </>
  );
}
