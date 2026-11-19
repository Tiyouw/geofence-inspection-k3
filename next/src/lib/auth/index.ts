import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import type { Role } from "@/lib/domain/constants";
import { authConfig } from "./config";
import { sisaKunciLuas } from "./kunci";

const credentialsSchema = z.object({
  nip: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
});

/** Hash pengganti agar waktu respons sama walau NIP tidak dikenal. */
const DUMMY_HASH = "$2b$10$JMyhwEhx0evFFGzeYncUI.XxyAixBcfMKoGVuQNxSCsUCLLNMmSo2";

/** SPEC §6.2: 5 gagal per kunci nip|ip, dikunci 60 detik; berhasil masuk membersihkan hitungan. */
export const MAX_GAGAL = 5;
export const KUNCI_DETIK = 60;


export class TerlaluBanyakPercobaan extends CredentialsSignin {
  constructor(sisaDetik: number) {
    super();
    this.code = `throttled:${sisaDetik}`;
  }
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Pembatas tanpa Redis, memakai audit_logs. Seperti RateLimiter Laravel: hitungan
 * berlaku 60 detik sejak percobaan gagal pertama di jendela itu. Mengembalikan sisa
 * detik kunci, atau 0 bila boleh mencoba. Satu kueri saja: tiap perjalanan ke basis
 * data menambah waktu masuk.
 */
async function sisaKunci(nip: string, ip: string | null): Promise<number> {
  const sejak = new Date(Date.now() - KUNCI_DETIK * 1000);
  const ipCocok = ip === null ? sql`${auditLogs.ip} is null` : eq(auditLogs.ip, ip);
  const [row] = await db
    .select({
      n: sql<number>`count(*) filter (where ${auditLogs.aksi} = 'masuk.gagal')::int`,
      pertama: sql<string | null>`min(${auditLogs.createdAt}) filter (where ${auditLogs.aksi} = 'masuk.gagal')`,
      berhasil: sql<string | null>`max(${auditLogs.createdAt}) filter (where ${auditLogs.aksi} = 'masuk')`,
    })
    .from(auditLogs)
    .where(
      and(
        sql`${auditLogs.aksi} in ('masuk', 'masuk.gagal')`,
        sql`${auditLogs.data}->>'nip' = ${nip}`,
        ipCocok,
        gt(auditLogs.createdAt, sejak),
      ),
    );
  if (!row || row.n < MAX_GAGAL || !row.pertama) return 0;
  // Gagal sebelum masuk berhasil terakhir tidak dihitung lagi.
  if (row.berhasil) {
    const [ulang] = await db
      .select({ n: sql<number>`count(*)::int`, pertama: sql<string | null>`min(${auditLogs.createdAt})` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.aksi, "masuk.gagal"),
          sql`${auditLogs.data}->>'nip' = ${nip}`,
          ipCocok,
          gt(auditLogs.createdAt, new Date(row.berhasil)),
        ),
      );
    if (!ulang || ulang.n < MAX_GAGAL || !ulang.pertama) return 0;
    row.pertama = ulang.pertama;
  }
  const lewat = (Date.now() - new Date(row.pertama).getTime()) / 1000;
  return Math.max(1, Math.ceil(KUNCI_DETIK - lewat));
}

/**
 * Wadah peran akun yang lolos `authorize` selama satu panggilan `signIn` (lihat masukDenganPeran).
 * Aksi masuk perlu peran itu, sedangkan cookie sesi baru belum terbaca pada permintaan yang sama.
 */
const wadahPeran = new AsyncLocalStorage<{ role: Role | null }>();

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

        // Pemeriksaan kunci dan pencarian akun berjalan bersamaan.
        const [sisaPasangan, sisaLuas, [user]] = await Promise.all([
          sisaKunci(nip, ip),
          sisaKunciLuas(nip, ip),
          db.select().from(users).where(eq(users.nip, nip)).limit(1),
        ]);
        const sisa = Math.max(sisaPasangan, sisaLuas);
        if (sisa > 0) throw new TerlaluBanyakPercobaan(sisa);

        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !ok || !user.aktif) {
          await db.insert(auditLogs).values({ aksi: "masuk.gagal", data: { nip }, ip, userId: user?.id ?? null });
          return null;
        }

        await Promise.all([
          db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
          db.insert(auditLogs).values({ aksi: "masuk", userId: user.id, ip, data: { nip } }),
        ]);
        const wadah = wadahPeran.getStore();
        if (wadah) wadah.role = user.role;

        return { id: String(user.id), name: user.name, email: user.email, role: user.role, nip: user.nip, sesiVersi: user.sesiVersi };
      },
    }),
  ],
});

/** `signIn` kredensial yang juga mengembalikan peran akun dari `authorize`, tanpa kueri tambahan. */
export async function masukDenganPeran(nip: string, password: string): Promise<Role | null> {
  const wadah: { role: Role | null } = { role: null };
  await wadahPeran.run(wadah, () => signIn("credentials", { nip, password, redirect: false }));
  return wadah.role;
}
