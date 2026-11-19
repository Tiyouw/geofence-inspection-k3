import { ASAL_UBIN } from "./geo/ubin";

/**
 * Content-Security-Policy, dimulai dalam mode Report-Only (audit 19 Nov 2026, S1): pelanggaran
 * hanya dilaporkan ke /api/csp, tidak diblokir. Setelah laporan bersih beberapa hari, header
 * dapat dipindah ke `Content-Security-Policy` (ganti 'unsafe-inline' skrip dengan nonce bila bisa).
 *
 * Sumber luar yang dipakai klien: ubin peta (lib/geo/ubin.ts: CARTO tanpa
 * label, cadangan OSM) dan Ably (realtime, REST + WebSocket).
 * Font dan media disajikan sendiri; foto bukti lewat /api/foto (blob privat tidak pernah ke klien).
 */
export const CSP_LAPOR = "/api/csp";

export function kebijakanCsp(pengembangan = process.env.NODE_ENV === "development"): string {
    const ably = [
        "https://*.ably.io",
        "wss://*.ably.io",
        "https://*.ably.net",
        "wss://*.ably.net",
        "https://*.ably-realtime.com",
        "wss://*.ably-realtime.com",
    ];
    const arahan: Record<string, string[]> = {
        "default-src": ["'self'"],
        // Next menyisipkan skrip inline (muatan RSC); React dev memakai eval.
        "script-src": ["'self'", "'unsafe-inline'", ...(pengembangan ? ["'unsafe-eval'"] : [])],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", ...ASAL_UBIN],
        "font-src": ["'self'", "data:"],
        "media-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'",
            ...ably,
            ...(pengembangan ? ["ws:", "http://127.0.0.1:*", "http://localhost:*"] : []),
        ],
        "worker-src": ["'self'", "blob:"],
        "manifest-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "report-uri": [CSP_LAPOR],
        "report-to": ["csp"],
    };
    return Object.entries(arahan)
        .map(([k, v]) => `${k} ${v.join(" ")}`)
        .join("; ");
}
