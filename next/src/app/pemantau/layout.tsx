import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_PEMANTAU } from "@/components/shell/nav";
import { requireRole } from "@/lib/auth/guards";

export default async function PemantauLayout({ children }: LayoutProps<"/pemantau">) {
  const user = await requireRole("admin", "pemantau");
  return (
    <DesktopShell user={user} nav={NAV_PEMANTAU}>
      {children}
    </DesktopShell>
  );
}
