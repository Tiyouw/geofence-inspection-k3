import type { MetadataRoute } from "next";

/**
 * Aplikasi belum dipublikasikan (keputusan pemilik 19 Nov 2026): semua mesin pencari ditolak,
 * kecuali SITUS_PUBLIK=true. Header X-Robots-Tag di next.config.ts mengikuti aturan yang sama.
 */
export default function robots(): MetadataRoute.Robots {
    if (process.env.SITUS_PUBLIK === "true")
        return {
            rules: {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin", "/pemantau", "/petugas", "/api", "/i/", "/tanya/"],
            },
        };
    return { rules: { userAgent: "*", disallow: "/" } };
}
