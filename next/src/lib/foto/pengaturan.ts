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
