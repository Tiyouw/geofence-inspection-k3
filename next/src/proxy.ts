import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

/**
 * Pemeriksaan optimistis (Next 16: middleware = proxy). Hanya membaca JWT;
 * otorisasi sebenarnya tetap di server lewat requireRole/assertRole.
 */
export default auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
