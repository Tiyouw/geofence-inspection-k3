import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";

/** /laporan (rute lama) → halaman laporan di papan pantau, filter dipertahankan. */
export default async function LaporanIndex({ searchParams }: PageProps<"/laporan">) {
  await requireRole("admin", "pemantau");
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  redirect(`/pemantau/laporan${q.size ? `?${q}` : ""}`);
}
