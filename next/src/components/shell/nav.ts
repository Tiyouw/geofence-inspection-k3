import type { NavIcon } from "./nav-icons";

export type NavItem = { href: string; label: string; icon: NavIcon };

/**
 * Menu per area. Sesi fitur MENAMBAH baris di area miliknya saja (lihat ARCHITECTURE.md).
 * Ikon ditulis sebagai nama (lihat nav-icons.ts) karena menu dirender komponen klien.
 */
export const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard" },
  { href: "/admin/aset", label: "Aset & APAR", icon: "apar" },
  { href: "/admin/lokasi", label: "Lokasi", icon: "lokasi" },
  { href: "/admin/checklist", label: "Checklist", icon: "checklist" },
  { href: "/admin/jadwal", label: "Jadwal", icon: "jadwal" },
  { href: "/admin/tinjauan", label: "Tinjauan", icon: "temuan" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "pengguna" },
];

export const NAV_PEMANTAU: NavItem[] = [
  { href: "/pemantau", label: "Papan pantau", icon: "grafik" },
  { href: "/pemantau/temuan", label: "Temuan", icon: "temuan" },
  { href: "/pemantau/laporan", label: "Laporan", icon: "laporan" },
];

export const NAV_PETUGAS: NavItem[] = [
  { href: "/petugas", label: "Beranda", icon: "beranda" },
  { href: "/petugas/pindai", label: "Pindai", icon: "pindai" },
  { href: "/petugas/riwayat", label: "Riwayat", icon: "riwayat" },
];
