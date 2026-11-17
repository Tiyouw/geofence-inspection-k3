/**
 * Aturan hak akses per peran dan unit kerja (PRD "Roles and permissions", ADR-5, ADR-9).
 * Murni: dipakai peladen (otorisasi sebenarnya) dan klien (pesan yang sama).
 *
 * - Inspektur: hanya aset yang tipenya dimiliki unit kerjanya (`asset_types.owner_division_id`).
 *   Inspektur tanpa unit tidak dapat menginspeksi apa pun.
 * - Administrator K3 (superadmin): semua data, pengelolaan data induk, dan tinjauan.
 * - Pemantau: membaca semua data dan meninjau; tidak mengubah data induk.
 */
import { PERAN_PENINJAU, type Role } from "./constants";

export type PenggunaUnit = { role: Role; divisionId: number | null };

/** Inspektur boleh membuka/menginspeksi aset dengan unit pemilik ini. */
export function bolehInspeksiAset(user: PenggunaUnit, ownerDivisionId: number | null): boolean {
  return user.role === "inspektur" && user.divisionId !== null && ownerDivisionId !== null && user.divisionId === ownerDivisionId;
}

/** Meninjau inspeksi "perlu tinjauan" dan "area terbatas": Administrator K3 atau Pemantau. */
export function bolehMeninjau(role: Role): boolean {
  return PERAN_PENINJAU.includes(role);
}

/** Mengubah data induk (aset, area, checklist, akun, token): hanya Administrator K3. */
export function bolehKelolaData(role: Role): boolean {
  return role === "admin";
}

/** Melihat semua inspeksi, foto, dan temuan lintas unit; inspektur hanya miliknya sendiri. */
export function bolehLihatSemua(role: Role): boolean {
  return role === "admin" || role === "pemantau";
}

/** PRD "Alur pengguna" Inspektur langkah 3. */
export function pesanAsetUnitLain(unitAset: string | null, unitPengguna: string | null): string {
  const pemilik = unitAset ?? "unit lain";
  if (!unitPengguna) return `Aset ini milik ${pemilik}. Akun Anda belum terdaftar di unit kerja. Hubungi Admin K3.`;
  return `Aset ini milik ${pemilik}. Anda hanya dapat menginspeksi aset ${unitPengguna}.`;
}
