import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

export const PER_HALAMAN_AUDIT = 50;

/** Kelompok aksi untuk filter: awalan sebelum titik ("aset", "pengguna", "masuk", ...). */
export async function kelompokAksi(): Promise<string[]> {
    const rows = await db
        .selectDistinct({ k: sql<string>`split_part(${auditLogs.aksi}, '.', 1)` })
        .from(auditLogs)
        .orderBy(sql`1`);
    return rows.map((r) => r.k);
}

export async function daftarAudit(f: { kelompok?: string; pengguna?: number }, halaman = 1) {
    const syarat = and(
        f.kelompok ? sql`split_part(${auditLogs.aksi}, '.', 1) = ${f.kelompok}` : undefined,
        f.pengguna ? eq(auditLogs.userId, f.pengguna) : undefined,
    );
    const [rows, [jumlah]] = await Promise.all([
        db
            .select({
                id: auditLogs.id,
                aksi: auditLogs.aksi,
                entitas: auditLogs.entitas,
                entitasId: auditLogs.entitasId,
                data: auditLogs.data,
                ip: auditLogs.ip,
                createdAt: auditLogs.createdAt,
                oleh: users.name,
                olehNip: users.nip,
            })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.userId))
            .where(syarat)
            .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
            .limit(PER_HALAMAN_AUDIT)
            .offset((halaman - 1) * PER_HALAMAN_AUDIT),
        db.select({ n: count() }).from(auditLogs).where(syarat),
    ]);
    return { rows, total: jumlah?.n ?? 0 };
}
