import { KerangkaInspektur } from "@/features/inspeksi/ui/kerangka";
import { TombolBantuan } from "@/features/onboarding/onboarding";
import { OnboardingPeran } from "@/features/onboarding/peran";
import { PetugasProvider } from "@/features/inspeksi/ui/konteks";
import { requireRole } from "@/lib/auth/guards";
import { saluranUntuk } from "@/lib/realtime/saluran";
import { konfigurasiKlien } from "@/lib/realtime/server";

/** Halaman menu inspektur (sama dengan NAV_INSPEKTUR di kerangka.tsx, modul klien). */
const MENU_INSPEKTUR = ["/petugas", "/petugas/pindai", "/petugas/antrean", "/petugas/riwayat", "/petugas/profil"];

export default async function PetugasLayout({ children }: LayoutProps<"/petugas">) {
  const user = await requireRole("inspektur");
  const rt = konfigurasiKlien();
  return (
    <PetugasProvider userId={user.id} realtime={rt ? { ...rt, saluran: saluranUntuk(user) } : null}>
      <KerangkaInspektur>
        <OnboardingPeran user={user} beranda="/petugas" />
        <TombolBantuan varian="melayang" beranda="/petugas" hanyaDi={MENU_INSPEKTUR} className="print:hidden" />
        {children}
      </KerangkaInspektur>
    </PetugasProvider>
  );
}
