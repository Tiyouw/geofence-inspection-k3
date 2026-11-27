/**
 * Penerima laporan pelanggaran CSP (mode Report-Only, src/lib/csp.ts). Publik karena peramban
 * mengirim laporan tanpa sesi. Isi dipotong dan hanya ditulis ke log peladen; tidak disimpan.
 */
const MAKS_BYTE = 16 * 1024;

export async function POST(req: Request) {
    const teks = (await req.text()).slice(0, MAKS_BYTE);
    try {
        const isi = JSON.parse(teks) as unknown;
        const daftar = Array.isArray(isi) ? isi : [isi];
        for (const l of daftar.slice(0, 10)) {
            const r = ((l as { body?: unknown })?.body ??
                (l as { "csp-report"?: unknown })?.["csp-report"] ??
                l) as Record<string, unknown>;
            console.warn(
                "csp",
                JSON.stringify({
                    arahan: r["effectiveDirective"] ?? r["effective-directive"] ?? r["violated-directive"],
                    diblokir: String(r["blockedURL"] ?? r["blocked-uri"] ?? "").slice(0, 200),
                    halaman: String(r["documentURL"] ?? r["document-uri"] ?? "")
                        .replace(/[?#].*$/, "")
                        .slice(0, 200),
                }),
            );
        }
    } catch {
        // Laporan rusak diabaikan.
    }
    return new Response(null, { status: 204 });
}
