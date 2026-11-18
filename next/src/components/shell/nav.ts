import type { NavIcon } from "./nav-icons";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Judul kelompok di bilah samping (arah A). Tanpa grup = kelompok pertama. */
  grup?: "Harian" | "Data" | "Lainnya";
  /** Tampil di bilah tab bawah pada ponsel; sisanya di "Lainnya". */
  bawah?: boolean;
  /** Angka lencana, mis. jumlah antrean tinjauan. */
  lencana?: number;
};

/**
 * Menu per area. Sesi fitur MENAMBAH baris di area miliknya saja (lihat ARCHITECTURE.md).
 * Ikon ditulis sebagai nama (lihat nav-icons.ts) karena menu dirender komponen klien.
 */
export const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard", grup: "Harian", bawah: true },
  { href: "/admin/tinjauan", label: "Tinjauan", icon: "tinjauan", grup: "Harian", bawah: true },
  { href: "/admin/jadwal", label: "Jadwal", icon: "jadwal", grup: "Harian", bawah: true },
  { href: "/admin/temuan", label: "Temuan", icon: "temuan", grup: "Harian" },
  { href: "/admin/aset", label: "Aset", icon: "apar", grup: "Data", bawah: true },
  { href: "/admin/lokasi", label: "Lokasi & area", icon: "lokasi", grup: "Data" },
  { href: "/laporan", label: "Laporan", icon: "laporan", grup: "Data" },
  { href: "/admin/checklist", label: "Checklist", icon: "checklist", grup: "Data" },
  { href: "/stiker", label: "Stiker QR", icon: "pindai", grup: "Lainnya" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "pengguna", grup: "Lainnya" },
  { href: "/admin/audit", label: "Riwayat perubahan", icon: "riwayat", grup: "Lainnya" },
];

export const NAV_PEMANTAU: NavItem[] = [
  { href: "/pemantau", label: "Papan pantau", icon: "grafik", grup: "Harian", bawah: true },
  { href: "/pemantau/tinjauan", label: "Tinjauan", icon: "tinjauan", grup: "Harian", bawah: true },
  { href: "/pemantau/inspeksi", label: "Inspeksi", icon: "checklist", grup: "Harian", bawah: true },
  { href: "/pemantau/temuan", label: "Temuan", icon: "temuan", grup: "Data", bawah: true },
  { href: "/pemantau/laporan", label: "Laporan", icon: "laporan", grup: "Data" },
];

/** Menu dengan lencana jumlah antrean pada butir Tinjauan. */
export function denganLencanaTinjauan(nav: NavItem[], antrean: number): NavItem[] {
  return nav.map((n) => (n.href.endsWith("/tinjauan") && antrean > 0 ? { ...n, lencana: antrean } : n));
}

export const NAV_PETUGAS: NavItem[] = [
  { href: "/petugas", label: "Beranda", icon: "beranda" },
  { href: "/petugas/pindai", label: "Pindai", icon: "pindai" },
  { href: "/petugas/riwayat", label: "Riwayat", icon: "riwayat" },
];
