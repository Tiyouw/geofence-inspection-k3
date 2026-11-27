import type { Metadata } from "next";
import { Profil } from "@/features/inspeksi/ui/profil";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await requireRole("inspektur");
  return <Profil nama={user.name} nip={user.nip} jabatan={user.jabatan} />;
}
