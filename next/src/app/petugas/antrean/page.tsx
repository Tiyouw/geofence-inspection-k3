import type { Metadata } from "next";
import { Antrean } from "@/features/inspeksi/ui/antrean";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Antrean kirim" };

/** Antrean kirim dan status sinkron, dibaca dari data di perangkat supaya tetap jalan luring. */
export default async function AntreanPage() {
  await requireRole("inspektur");
  return <Antrean />;
}
