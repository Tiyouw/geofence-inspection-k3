import { requireRole } from "@/lib/auth/guards";

/** Lembar stiker memuat token QR: hanya admin (ARCHITECTURE K-06, SPEC §9 celah #3). */
export default async function StikerLayout({ children }: LayoutProps<"/stiker">) {
  await requireRole("admin");
  return children;
}
