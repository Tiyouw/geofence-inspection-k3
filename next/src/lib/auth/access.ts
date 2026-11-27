/**
 * Peta akses per peran. Satu sumber kebenaran untuk proxy dan guard server.
 * Murni (tanpa I/O) supaya bisa diuji dan dipakai di mana saja.
 */
import { ROLE_HOME, type Role } from "@/lib/domain/constants";

/** Awalan rute dan peran yang boleh membukanya. Rute yang tidak tercantum butuh login saja. */
export const AREA_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/pemantau", roles: ["admin", "pemantau"] },
  { prefix: "/petugas", roles: ["inspektur"] },
  { prefix: "/i", roles: ["inspektur"] }, // pintasan stiker QR: /i/{token}
  // Lembar stiker memuat token QR: hanya admin (SPEC §1.4 / §9 celah #3, menunggu konfirmasi pemilik).
  { prefix: "/stiker", roles: ["admin"] },
  { prefix: "/laporan", roles: ["admin", "pemantau"] },
];

/** /panduan: panduan mencoba aplikasi untuk klien (tanpa login), lihat src/features/panduan. */
const PUBLIC_PATHS = ["/", "/masuk", "/offline", "/panduan"];
/**
 * /api/* dilewatkan proxy: Route Handler memeriksa sesi sendiri dan membalas 401/403 JSON,
 * bukan pengalihan HTML ke /masuk (antrean luring perlu membedakan "sesi habis").
 */
const PUBLIC_PREFIXES = ["/api/", "/panduan/opengraph-image", "/tanya/", "/_next", "/icons", "/manifest.webmanifest", "/sw.js", "/favicon", "/media/", "/geofencing.svg", "/robots.txt"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function canAccessPath(role: Role | undefined, pathname: string): boolean {
  const area = AREA_ACCESS.find((a) => matches(pathname, a.prefix));
  if (!area) return true;
  return role !== undefined && area.roles.includes(role);
}

export function homeFor(role: Role | undefined): string {
  return role ? ROLE_HOME[role] : "/masuk";
}

/** callbackUrl hanya boleh jalur internal yang boleh dibuka peran itu; selain itu ke beranda peran. */
export function safeRedirect(role: Role, callbackUrl: string | null | undefined): string {
  if (!callbackUrl) return homeFor(role);
  let target: URL;
  try {
    // Auth.js memberi URL absolut; hanya jalur dan query yang dipakai, host diabaikan.
    target = new URL(callbackUrl, "http://internal.invalid");
  } catch {
    return homeFor(role);
  }
  if (callbackUrl.startsWith("//") || callbackUrl.startsWith("\\")) return homeFor(role);
  const path = target.pathname;
  if (isPublicPath(path) || !canAccessPath(role, path)) return homeFor(role);
  return path + target.search;
}
