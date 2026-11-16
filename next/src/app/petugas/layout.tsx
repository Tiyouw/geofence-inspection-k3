import { MobileShell } from "@/components/shell/app-shell";
import { NAV_PETUGAS } from "@/components/shell/nav";
import { PetugasProvider } from "@/features/inspeksi/ui/konteks";
import { IndikatorKoneksi, TombolKeluar } from "@/features/inspeksi/ui/status-bar";
import { requireRole } from "@/lib/auth/guards";

export default async function PetugasLayout({ children }: LayoutProps<"/petugas">) {
  const user = await requireRole("inspektur");
  return (
    <PetugasProvider userId={user.id}>
      <MobileShell user={user} nav={NAV_PETUGAS} status={<IndikatorKoneksi />} keluar={<TombolKeluar />}>
        {children}
      </MobileShell>
    </PetugasProvider>
  );
}
