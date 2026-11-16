import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FireExtinguisher,
  History,
  LayoutDashboard,
  MapPin,
  QrCode,
  ScanSearch,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Ikon menu. Tambah entri di sini bila menu baru butuh ikon lain. */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  apar: FireExtinguisher,
  lokasi: MapPin,
  checklist: ClipboardList,
  jadwal: CalendarClock,
  temuan: ShieldAlert,
  pengguna: Users,
  grafik: BarChart3,
  laporan: FileText,
  beranda: ClipboardCheck,
  pindai: QrCode,
  riwayat: History,
  tinjauan: ScanSearch,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof NAV_ICONS;
