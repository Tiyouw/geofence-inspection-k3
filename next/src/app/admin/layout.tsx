import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN } from "@/components/shell/nav";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("admin");
  return (
    <DesktopShell user={user} nav={NAV_ADMIN}>
      {children}
    </DesktopShell>
  );
}
