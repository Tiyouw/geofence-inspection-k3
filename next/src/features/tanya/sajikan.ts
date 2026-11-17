import "server-only";
import { bacaFoto } from "@/lib/storage/photos";

/** Menyajikan lampiran privat lewat fungsi (URL Blob tidak pernah sampai ke klien). */
export async function sajikanLampiran(row: { storageKey: string; contentType: string; nama: string }) {
    const berkas = await bacaFoto(row.storageKey);
    if (!berkas) return new Response("Berkas hilang", { status: 404 });
    // SVG/HTML tidak pernah inline: bisa menjalankan skrip di domain kita.
    const gambar = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(row.contentType);
    return new Response(berkas.stream, {
        headers: {
            "Content-Type": row.contentType,
            ...(berkas.size ? { "Content-Length": String(berkas.size) } : {}),
            "Content-Disposition": `${gambar ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.nama)}`,
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
            "Content-Security-Policy": "sandbox",
        },
    });
}
