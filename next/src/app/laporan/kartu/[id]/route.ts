import type { NextRequest } from "next/server";
import { z } from "zod";
import { tanggalIso } from "@/features/laporan/format";
import { izinLaporan, jawabPdf, teks } from "@/features/laporan/http";
import { renderKartu } from "@/features/laporan/pdf/render";

export const maxDuration = 60;

const skema = z.object({ id: z.coerce.number().int().positive(), tahun: z.coerce.number().int().min(2020).max(2100).optional() });

/** GET /laporan/kartu/{asetId}?tahun → Kartu-Kontrol-{kode}-{tahun}.pdf (SPEC §4.9, ACCEPTANCE L5). */
export async function GET(req: NextRequest, ctx: RouteContext<"/laporan/kartu/[id]">) {
  const izin = await izinLaporan();
  if (izin instanceof Response) return izin;
  const tahunQ = req.nextUrl.searchParams.get("tahun");
  const p = skema.safeParse({ id: (await ctx.params).id, tahun: tahunQ || undefined });
  if (!p.success) return teks("Parameter kartu tidak sah.", 422);
  const now = new Date();
  const tahun = p.data.tahun ?? Number(tanggalIso(now).slice(0, 4));
  const hasil = await renderKartu(p.data.id, tahun, now);
  if (!hasil) return teks("Aset tidak ditemukan.", 404);
  return jawabPdf(hasil.buffer, `Kartu-Kontrol-${hasil.kode}-${tahun}.pdf`, req.nextUrl.searchParams.has("unduh"));
}
