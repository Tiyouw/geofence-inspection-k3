import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { authConfig } from "./config";

const credentialsSchema = z.object({
  nip: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
});

/** Hash pengganti agar waktu respons sama walau NIP tidak dikenal. */
const DUMMY_HASH = "$2b$10$JMyhwEhx0evFFGzeYncUI.XxyAixBcfMKoGVuQNxSCsUCLLNMmSo2";

export const MAX_GAGAL = 5;
export const JENDELA_GAGAL_MENIT = 15;

export class TerlaluBanyakPercobaan extends CredentialsSignin {
  code = "throttled";
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Pembatas percobaan sederhana memakai audit_logs (tanpa Redis): 5 gagal per NIP per 15 menit. */
async function terlaluBanyakGagal(nip: string): Promise<boolean> {
  const sejak = new Date(Date.now() - JENDELA_GAGAL_MENIT * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.aksi, "masuk.gagal"),
        sql`${auditLogs.data}->>'nip' = ${nip}`,
        gt(auditLogs.createdAt, sejak),
      ),
    );
  return (row?.n ?? 0) >= MAX_GAGAL;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { nip: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const nip = parsed.data.nip.toLowerCase();
        const ip = await clientIp();

        if (await terlaluBanyakGagal(nip)) throw new TerlaluBanyakPercobaan();

        const [user] = await db.select().from(users).where(eq(users.nip, nip)).limit(1);
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !ok || !user.aktif) {
          await db.insert(auditLogs).values({ aksi: "masuk.gagal", data: { nip }, ip, userId: user?.id ?? null });
          return null;
        }

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        await db.insert(auditLogs).values({ aksi: "masuk", userId: user.id, ip });

        return { id: String(user.id), name: user.name, email: user.email, role: user.role, nip: user.nip };
      },
    }),
  ],
});
