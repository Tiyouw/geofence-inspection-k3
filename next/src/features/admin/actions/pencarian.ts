"use server";

import { z } from "zod";
import { AksesDitolak, assertRole } from "@/lib/auth/guards";
import type { KelompokCari } from "../lib/pencarian";
import { cariPanel } from "../server/pencarian";

/** Admin dan pemantau; hasil disaring per peran di cariPanel. Hanya membaca (K6). */
export async function cari(q: unknown): Promise<KelompokCari[]> {
  try {
    const user = await assertRole("admin", "pemantau");
    const teks = z.string().max(200).catch("").parse(q);
    return await cariPanel(teks, user.role);
  } catch (e) {
    if (e instanceof AksesDitolak) return [];
    throw e;
  }
}
