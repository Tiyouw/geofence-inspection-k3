import type { NextConfig } from "next";

/**
 * cacheComponents sengaja tidak diaktifkan: hampir semua halaman bergantung pada
 * sesi pengguna (dinamis), dan tiga sesi pengembangan paralel lebih aman dengan
 * model render dinamis biasa. Lihat docs/v2/ARCHITECTURE.md, keputusan K-03.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    /*
     * Cache Turbopack untuk `next build` (dipulihkan Vercel antar-deploy) tidak membatalkan
     * keluaran @tailwindcss/turbopack saat token di globals.css berubah: dev.geofencinspection.tech
     * menyajikan --warning lama setelah PR #7. Build dingin sedikit lebih lambat, CSS selalu benar.
     */
    turbopackFileSystemCacheForBuild: false,
  },
  // PDF laporan (sesi Laporan): @react-pdf/renderer dijalankan apa adanya di Node, dan
  // font DejaVu yang dibaca lewat fs ikut dibundel ke fungsi rute /laporan.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/laporan/**": ["./src/features/laporan/pdf/fonts/*.ttf"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  /** Pintu panel lama (Filament) diganti satu pintu /masuk (ARCHITECTURE K-01). Dijalankan sebelum proxy. */
  async redirects() {
    return [{ source: "/admin/login", destination: "/masuk", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
      {
        // Formulir klien bertoken: jangan diindeks, jangan dikirim sebagai Referer ke luar.
        source: "/tanya/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
