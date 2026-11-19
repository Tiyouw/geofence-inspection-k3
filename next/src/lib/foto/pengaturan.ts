import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { bacaCapKoordinat, SETTING_CAP_KOORDINAT } from "./cap";

type Pembaca = Pick<typeof db, "select">;

/** Pengaturan admin: koordinat tampil di cap foto? Bawaan mati. */
export async function capKoordinatAktif(tx: Pembaca = db): Promise<boolean> {
  const [r] = await tx.select({ nilai: settings.nilai }).from(settings).where(eq(settings.kunci, SETTING_CAP_KOORDINAT));
  return bacaCapKoordinat(r?.nilai);
}

/**
 * Koordinat mentah boleh tampil untuk pengguna sesi ini? Hanya Admin K3, dan hanya bila
 * pengaturan koordinat menyala (ADR-15). Pemantau, inspektur, dan PDF tidak pernah menerimanya.
 */
export async function koordinatUntukSesi(tx: Pembaca = db): Promise<boolean> {
  // Impor dinamis: modul sesi menarik next-auth, yang tidak perlu dimuat uji non-sesi.
  const { getCurrentUser } = await import("@/lib/auth/guards");
  const user = await getCurrentUser();
  return koordinatUntukPeran(user?.role, await capKoordinatAktif(tx));
}

/** Aturan murni di balik koordinatUntukSesi (diuji tersendiri). */
export function koordinatUntukPeran(peran: string | null | undefined, pengaturanMenyala: boolean): boolean {
  return peran === "admin" && pengaturanMenyala;
}
