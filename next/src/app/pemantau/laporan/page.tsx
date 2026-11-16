import type { Metadata } from "next";
import { HalamanLaporan } from "@/features/laporan/halaman-laporan";

export const metadata: Metadata = { title: "Laporan bulanan" };

export default async function LaporanPemantauPage({ searchParams }: PageProps<"/pemantau/laporan">) {
  return <HalamanLaporan q={await searchParams} />;
}
