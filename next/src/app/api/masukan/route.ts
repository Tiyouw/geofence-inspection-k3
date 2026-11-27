import { periksaGambar, skemaMasukan } from "@/features/masukan/jenis";
import { cekBatasLaju, hashPengirim, simpanMasukan } from "@/features/masukan/server";
import { galat, json } from "@/features/inspeksi/server/http";

/**
 * Masukan dari /panduan (rute publik, tanpa login). multipart/form-data:
 * nama, jenis, konteks, langkah, isi, gambar (opsional). Dibatasi laju per pengirim dan global.
 */
export async function POST(req: Request) {
    // Formulir hanya dari halaman aplikasi ini sendiri.
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) return galat(403, "asal", "Asal permintaan tidak sah.");

    let fd: FormData;
    try {
        fd = await req.formData();
    } catch {
        return galat(400, "format", "Formulir tidak terbaca.");
    }
    const teks = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : undefined);
    const parsed = skemaMasukan.safeParse({
        nama: teks("nama") ?? "",
        jenis: teks("jenis"),
        konteks: teks("konteks") ?? "",
        langkah: teks("langkah"),
        isi: teks("isi") ?? "",
    });
    if (!parsed.success) return galat(422, "validasi", parsed.error.issues[0]?.message ?? "Isian tidak sah.");

    const berkas = fd.get("gambar");
    let gambar: { data: Uint8Array; contentType: string } | null = null;
    if (berkas instanceof File && berkas.size > 0) {
        const cek = periksaGambar(berkas);
        if (!cek.ok) return galat(422, "gambar", cek.pesan);
        gambar = { data: new Uint8Array(await berkas.arrayBuffer()), contentType: berkas.type };
    }

    const pengirimHash = hashPengirim(req.headers);
    const ditolak = await cekBatasLaju(pengirimHash);
    if (ditolak) return galat(429, "batas_laju", ditolak);

    const { id } = await simpanMasukan(parsed.data, { pengirimHash, userAgent: req.headers.get("user-agent") }, gambar);
    return json({ id }, 201);
}
