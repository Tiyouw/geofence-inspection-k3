/**
 * Konfigurasi Auth.js yang aman dipakai di proxy (tanpa basis data, tanpa bcrypt).
 * Provider credentials dan akses DB ada di src/lib/auth/index.ts.
 */
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/domain/constants";
import { canAccessPath, homeFor, isPublicPath } from "./access";

export const authConfig = {
  pages: { signIn: "/masuk", error: "/masuk" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = Number(user.id);
        token.role = user.role;
        token.nip = user.nip;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid);
      session.user.role = token.role as Role;
      session.user.nip = token.nip as string;
      return session;
    },
    /** Pemeriksaan optimistis di proxy. Pemeriksaan sebenarnya di server (guards.ts). */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) {
        if (auth?.user && pathname === "/masuk") {
          return Response.redirect(new URL(homeFor(auth.user.role), request.nextUrl));
        }
        return true;
      }
      if (!auth?.user) return false; // ke /masuk?callbackUrl=...
      if (!canAccessPath(auth.user.role, pathname)) {
        return Response.redirect(new URL(homeFor(auth.user.role), request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
