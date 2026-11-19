import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { and, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { Panduan } from "@/features/panduan/panduan";
import { SLIDES } from "@/features/panduan/slides";
import "./panduan.css";

export const metadata: Metadata = {
    title: "Panduan mencoba",
    description: "Panduan langkah demi langkah mencoba PAL-K3 v2 sebagai inspektur, admin, dan pemantau.",
    robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#031e25" };

const svg = (url: string) => QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4 });

/**
 * Panduan untuk klien (rute publik). Akun demo dan stiker contoh hanya tampil bila DEMO_MODE=true,
 * sama seperti halaman /masuk; di produksi tanpa demo panduan tetap bisa dibaca tanpa kredensial.
 */
export default async function HalamanPanduan() {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    const origin = `${proto}://${host}`;
    const demo = process.env.DEMO_MODE === "true";

    const kunciQr = new Set(SLIDES.flatMap((s) => s.qr?.map((q) => q.kunci) ?? []));
    const halaman: Record<string, string> = { masuk: "/masuk", petugas: "/petugas", admin: "/admin", pemantau: "/pemantau" };
    const qr: Record<string, string> = {};
    for (const k of kunciQr) qr[k] = await svg(origin + (halaman[k] ?? "/"));
    for (const s of SLIDES) if (s.coba && s.alat === "hp" && !qr[s.coba.href]) qr[s.coba.href] = await svg(origin + s.coba.href);

    // Stiker contoh: hanya aset demo (kode DEMO-), supaya token aset asli tidak pernah tampil di halaman publik.
    const stiker: Record<string, string> = {};
    if (demo) {
        const kode = SLIDES.flatMap((s) => s.stiker?.map((x) => x.kode) ?? []);
        const rows = kode.length
            ? await db
                  .select({ kode: assets.kode, token: assets.qrToken })
                  .from(assets)
                  .where(and(inArray(assets.kode, kode), like(assets.kode, "DEMO-%")))
            : [];
        for (const r of rows) if (r.token) stiker[r.kode] = await svg(`${origin}/i/${encodeURIComponent(r.token)}`);
    }

    return <Panduan slides={SLIDES} qr={qr} stiker={stiker} demo={demo} />;
}
