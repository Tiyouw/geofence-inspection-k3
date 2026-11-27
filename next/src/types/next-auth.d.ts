import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/domain/constants";

declare module "next-auth" {
  interface User {
    role: Role;
    nip: string;
    sesiVersi?: number;
  }
  interface Session {
    user: { id: string; role: Role; nip: string; sesiVersi?: number } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: number;
    role?: Role;
    nip?: string;
    sv?: number;
  }
}
