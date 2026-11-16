import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Geofencing — Inspeksi K3 APAR",
    short_name: "PAL-K3",
    description: "Inspeksi APAR berbasis QR dan lokasi.",
    lang: "id",
    start_url: "/petugas",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#031e25",
    theme_color: "#031e25",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
