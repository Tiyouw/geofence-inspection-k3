import "server-only";
/**
 * Pembatas masuk lintas pasangan nip|ip, memakai audit_logs (tanpa Redis), dipisah dari
 * index.ts supaya dapat diuji tanpa next-auth.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Batas tambahan (audit 19 Nov 2026, S2), keduanya tanpa melihat pasangan nip|ip:
 * - per NIP dari IP mana pun: 20 gagal dalam 15 menit mengunci NIP itu sampai 15 menit sejak gagal
 *   pertama (menebak satu akun dari banyak IP); masuk berhasil membersihkan hitungan;
 * - per IP untuk NIP mana pun: 50 gagal dalam 10 menit mengunci IP itu (satu sandi dicoba ke banyak NIP).
 */
export const MAX_GAGAL_NIP = 20;
export const JENDELA_NIP_DETIK = 15 * 60;
export const MAX_GAGAL_IP = 50;
export const JENDELA_IP_DETIK = 10 * 60;

/** Kunci luas per NIP (semua IP) dan per IP (semua NIP); sisa detik atau 0. */
export async function sisaKunciLuas(nip: string, ip: string | null): Promise<number> {
    const sekarang = Date.now();
    const sejakNip = new Date(sekarang - JENDELA_NIP_DETIK * 1000);
    const [perNip, perIp] = await Promise.all([
        db
            .select({
                n: sql<number>`count(*)::int`,
                pertama: sql<string | null>`min(${auditLogs.createdAt})`,
            })
            .from(auditLogs)
            .where(
                and(
                    eq(auditLogs.aksi, "masuk.gagal"),
                    sql`${auditLogs.data}->>'nip' = ${nip}`,
                    gt(auditLogs.createdAt, sejakNip),
                    // Gagal sebelum masuk berhasil terakhir untuk NIP ini tidak dihitung.
                    sql`not exists (select 1 from ${auditLogs} b where b.aksi = 'masuk' and b.data->>'nip' = ${nip} and b.created_at > ${auditLogs.createdAt})`,
                ),
            ),
        ip === null
            ? Promise.resolve([{ n: 0, pertama: null }])
            : db
                  .select({ n: sql<number>`count(*)::int`, pertama: sql<string | null>`min(${auditLogs.createdAt})` })
                  .from(auditLogs)
                  .where(
                      and(
                          eq(auditLogs.aksi, "masuk.gagal"),
                          eq(auditLogs.ip, ip),
                          gt(auditLogs.createdAt, new Date(sekarang - JENDELA_IP_DETIK * 1000)),
                      ),
                  ),
    ]);
    const sisa = (r: { n: number; pertama: string | null } | undefined, maks: number, jendela: number) =>
        r && r.n >= maks && r.pertama
            ? Math.max(1, Math.ceil(jendela - (sekarang - new Date(r.pertama).getTime()) / 1000))
            : 0;
    return Math.max(sisa(perNip[0], MAX_GAGAL_NIP, JENDELA_NIP_DETIK), sisa(perIp[0], MAX_GAGAL_IP, JENDELA_IP_DETIK));
}
