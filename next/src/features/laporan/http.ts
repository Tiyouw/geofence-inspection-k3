import "server-only";
import { z } from "zod";
import { AksesDitolak, assertRole, type SessionUser } from "@/lib/auth/guards";
import { tanggalIso } from "./format";
import type { FilterPeriode } from "./queries";

/** Filter laporan (LaporanController::saring): tipe bawaan apar, tahun 2020..2100, bulan 1..12. */
export const skemaFilter = z.object({
  tipe: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,32}$/)
    .optional(),
  tahun: z.coerce.number().int().min(2020).max(2100).optional(),
  bulan: z.coerce.number().int().min(1).max(12).optional(),
  gedung: z.string().trim().max(64).optional(),
});

export function bacaFilter(params: URLSearchParams | Record<string, string | string[] | undefined>, now = new Date()) {
  const obj =
    params instanceof URLSearchParams
      ? Object.fromEntries(params)
      : Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  // Kolom kosong dari formulir GET dianggap tidak diisi.
  for (const k of Object.keys(obj)) if (obj[k] === "") delete obj[k];
  const hasil = skemaFilter.safeParse(obj);
  if (!hasil.success) return null;
  const iso = tanggalIso(now);
  const f: FilterPeriode = {
    tipe: hasil.data.tipe ?? "apar",
    tahun: hasil.data.tahun ?? Number(iso.slice(0, 4)),
    bulan: hasil.data.bulan ?? Number(iso.slice(5, 7)),
    gedung: hasil.data.gedung || null,
  };
  return f;
}

/** Otorisasi Route Handler laporan: admin dan pemantau saja (SPEC §1.4). */
export async function izinLaporan(): Promise<SessionUser | Response> {
  try {
    return await assertRole("admin", "pemantau");
  } catch (e) {
    if (e instanceof AksesDitolak) {
      return new Response(e.status === 401 ? "Silakan masuk terlebih dahulu." : "Halaman ini hanya untuk Admin K3 dan Pemantau K3LH.", {
        status: e.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw e;
  }
}

/** Nama berkas aman untuk header Content-Disposition. */
export function namaBerkas(nama: string): string {
  return nama.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/** PDF dialirkan inline seperti dompdf `stream()`; `?unduh=1` memaksa unduhan. */
export function jawabPdf(isi: Buffer, nama: string, unduh: boolean): Response {
  return new Response(new Uint8Array(isi), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(isi.byteLength),
      "Content-Disposition": `${unduh ? "attachment" : "inline"}; filename="${namaBerkas(nama)}"`,
      // Berisi data internal: jangan disimpan CDN.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const teks = (pesan: string, status: number) =>
  new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
