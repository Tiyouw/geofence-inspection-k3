import type { Metadata } from "next";
import { HalamanLaporan } from "@/features/laporan/halaman-laporan";

export const metadata: Metadata = { title: "Laporan bulanan" };

/** /laporan (rute lama dan menu Admin "Laporan bulanan"): isi sama dengan /pemantau/laporan. */
export default async function LaporanPage({ searchParams }: PageProps<"/laporan">) {
  return <HalamanLaporan q={await searchParams} />;
}
