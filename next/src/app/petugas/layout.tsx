import { KerangkaInspektur } from "@/features/inspeksi/ui/kerangka";
import { PetugasProvider } from "@/features/inspeksi/ui/konteks";
import { requireRole } from "@/lib/auth/guards";
import { saluranUntuk } from "@/lib/realtime/saluran";
import { konfigurasiKlien } from "@/lib/realtime/server";

export default async function PetugasLayout({ children }: LayoutProps<"/petugas">) {
  const user = await requireRole("inspektur");
  const rt = konfigurasiKlien();
  return (
    <PetugasProvider userId={user.id} realtime={rt ? { ...rt, saluran: saluranUntuk(user) } : null}>
      <KerangkaInspektur>{children}</KerangkaInspektur>
    </PetugasProvider>
  );
}
