"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeRedirect } from "@/lib/auth/access";

export type MasukState = { error?: string; nip?: string };

const schema = z.object({
  nip: z.string().trim().min(1, "Isi NIP atau nama pengguna.").max(32),
  password: z.string().min(1, "Isi kata sandi."),
  callbackUrl: z.string().optional(),
});

export async function masuk(_prev: MasukState, formData: FormData): Promise<MasukState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const nip = String(formData.get("nip") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, nip };

  try {
    await signIn("credentials", { nip: parsed.data.nip, password: parsed.data.password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      if (code === "throttled") {
        return { error: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.", nip };
      }
      return { error: "NIP atau kata sandi salah, atau akun tidak aktif.", nip };
    }
    throw e;
  }

  // Cookie sesi baru belum terbaca pada permintaan ini, jadi peran diambil langsung dari DB.
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.nip, parsed.data.nip.toLowerCase()))
    .limit(1);
  redirect(user ? safeRedirect(user.role, parsed.data.callbackUrl) : "/masuk");
}

export async function keluar() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/masuk" });
}
