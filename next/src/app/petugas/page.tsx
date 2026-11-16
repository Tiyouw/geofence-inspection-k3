import type { Metadata } from "next";
import { Beranda } from "@/features/inspeksi/ui/beranda";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Beranda petugas" };

/** SPEC §3.10 + §7.9: beranda dibaca dari data di perangkat supaya tetap jalan luring. */
export default async function PetugasHome() {
  const user = await requireRole("inspektur");
  return <Beranda namaDepan={user.name.split(" ")[0] ?? user.name} />;
}
