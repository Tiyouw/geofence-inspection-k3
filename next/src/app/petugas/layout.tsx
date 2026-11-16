import { MobileShell } from "@/components/shell/app-shell";
import { NAV_PETUGAS } from "@/components/shell/nav";
import { requireRole } from "@/lib/auth/guards";

export default async function PetugasLayout({ children }: LayoutProps<"/petugas">) {
  const user = await requireRole("inspektur");
  return (
    <MobileShell user={user} nav={NAV_PETUGAS}>
      {children}
    </MobileShell>
  );
}
