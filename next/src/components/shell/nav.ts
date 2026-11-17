import type { NavIcon } from "./nav-icons";

export type NavItem = { href: string; label: string; icon: NavIcon };

/**
 * Menu per area. Sesi fitur MENAMBAH baris di area miliknya saja (lihat ARCHITECTURE.md).
 * Ikon ditulis sebagai nama (lihat nav-icons.ts) karena menu dirender komponen klien.
 */
export const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard" },
  { href: "/admin/tinjauan", label: "Tinjauan", icon: "tinjauan" },
  { href: "/admin/temuan", label: "Temuan", icon: "temuan" },
  { href: "/admin/aset", label: "Aset & APAR", icon: "apar" },
  { href: "/admin/lokasi", label: "Lokasi", icon: "lokasi" },
  { href: "/admin/jadwal", label: "Jadwal", icon: "jadwal" },
  { href: "/admin/checklist", label: "Checklist", icon: "checklist" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "pengguna" },
  { href: "/stiker", label: "Lembar stiker QR", icon: "pindai" },
  { href: "/laporan", label: "Laporan bulanan", icon: "laporan" },
  { href: "/admin/audit", label: "Jejak audit", icon: "riwayat" },
];

export const NAV_PEMANTAU: NavItem[] = [
  { href: "/pemantau", label: "Papan pantau", icon: "grafik" },
  { href: "/pemantau/tinjauan", label: "Tinjauan", icon: "tinjauan" },
  { href: "/pemantau/inspeksi", label: "Inspeksi", icon: "checklist" },
  { href: "/pemantau/temuan", label: "Temuan", icon: "temuan" },
  { href: "/pemantau/laporan", label: "Laporan", icon: "laporan" },
];

export const NAV_PETUGAS: NavItem[] = [
  { href: "/petugas", label: "Beranda", icon: "beranda" },
  { href: "/petugas/pindai", label: "Pindai", icon: "pindai" },
  { href: "/petugas/riwayat", label: "Riwayat", icon: "riwayat" },
];
