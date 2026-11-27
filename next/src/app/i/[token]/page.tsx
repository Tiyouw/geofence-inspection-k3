import type { Metadata } from "next";
import { MobileShell } from "@/components/shell/app-shell";
import { NAV_PETUGAS } from "@/components/shell/nav";
import { PetugasProvider } from "@/features/inspeksi/ui/konteks";
import { Pemindai } from "@/features/inspeksi/ui/pemindai";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Membuka stiker" };

/**
 * Pintasan stiker: isi QR adalah URL https://{host}/i/{token} (SPEC §3.1), sehingga kamera
 * bawaan ponsel bisa membukanya. Admin/pemantau dialihkan proxy ke berandanya tanpa membuat draf.
 * Token diproses di perangkat seperti pemindai (draf lokal + operasi start di antrean).
 */
export default async function StikerPage({ params }: PageProps<"/i/[token]">) {
  const user = await requireRole("inspektur");
  const { token } = await params;
  return (
    <PetugasProvider userId={user.id}>
      <MobileShell user={user} nav={NAV_PETUGAS}>
        <Pemindai tokenAwal={decodeURIComponent(token)} />
      </MobileShell>
    </PetugasProvider>
  );
}
