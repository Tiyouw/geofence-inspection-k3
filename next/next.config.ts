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
