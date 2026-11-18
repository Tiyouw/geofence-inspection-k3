import { KerangkaInspektur } from "@/features/inspeksi/ui/kerangka";
import { PetugasProvider } from "@/features/inspeksi/ui/konteks";
import { requireRole } from "@/lib/auth/guards";

export default async function PetugasLayout({ children }: LayoutProps<"/petugas">) {
  const user = await requireRole("inspektur");
  return (
    <PetugasProvider userId={user.id}>
      <KerangkaInspektur>{children}</KerangkaInspektur>
    </PetugasProvider>
  );
}
