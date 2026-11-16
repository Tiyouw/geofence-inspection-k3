import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, issueEvents, issues, users } from "@/db/schema";
import { ISSUE_STATUSES, SEVERITIES, type IssueStatus, type Severity } from "@/lib/domain/constants";
import { hariIniJakarta } from "@/lib/format";
import { polaMengandung } from "../lib/pencarian";

export type FilterTemuan = { q?: string; status?: IssueStatus | "belum_selesai"; severity?: Severity; lewat?: boolean };

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseFilterTemuan(sp: Record<string, string | string[] | undefined>): FilterTemuan {
    const status = satu(sp.status);
    const sev = satu(sp.tingkat);
    return {
        q: satu(sp.q),
        // Bawaan: yang belum selesai, karena itulah yang menuntut tindakan.
        status:
            status === undefined
                ? "belum_selesai"
                : status === "semua"
                  ? undefined
                  : (ISSUE_STATUSES as readonly string[]).includes(status)
                    ? (status as IssueStatus)
                    : "belum_selesai",
        severity: sev && (SEVERITIES as readonly string[]).includes(sev) ? (sev as Severity) : undefined,
        lewat: sp.lewat === "1",
    };
}

export const PER_HALAMAN_TEMUAN = 25;

export async function daftarTemuan(f: FilterTemuan, halaman = 1) {
    const hariIni = hariIniJakarta();
    const pic = alias(users, "pic");
    const syarat = and(
        f.status === "belum_selesai"
            ? ne(issues.status, "selesai")
            : f.status
              ? eq(issues.status, f.status)
              : undefined,
        f.severity ? eq(issues.severity, f.severity) : undefined,
        f.lewat ? and(ne(issues.status, "selesai"), lt(issues.targetSelesai, hariIni)) : undefined,
        f.q
            ? sql`(${issues.item} ilike ${polaMengandung(f.q)} escape '!' or ${assets.kode} ilike ${polaMengandung(f.q)} escape '!')`
            : undefined,
    );
    const [rows, [jumlah]] = await Promise.all([
        db
            .select({
                id: issues.id,
                item: issues.item,
                severity: issues.severity,
                status: issues.status,
                targetSelesai: issues.targetSelesai,
                createdAt: issues.createdAt,
                selesaiPada: issues.selesaiPada,
                asetId: assets.id,
                asetKode: assets.kode,
                asetLokasi: assets.lokasiTeks,
                asetGedung: assets.gedung,
                asetLantai: assets.lantai,
                pic: pic.name,
            })
            .from(issues)
            .innerJoin(assets, eq(assets.id, issues.assetId))
            .leftJoin(pic, eq(pic.id, issues.picUserId))
            .where(syarat)
            .orderBy(
                sql`case ${issues.status} when 'selesai' then 1 else 0 end`,
                sql`case ${issues.severity} when 'berat' then 0 when 'sedang' then 1 else 2 end`,
                asc(issues.createdAt),
            )
            .limit(PER_HALAMAN_TEMUAN)
            .offset((halaman - 1) * PER_HALAMAN_TEMUAN),
        db.select({ n: count() }).from(issues).innerJoin(assets, eq(assets.id, issues.assetId)).where(syarat),
    ]);
    return { rows, total: jumlah?.n ?? 0 };
}

export async function detailTemuan(id: number) {
    const pic = alias(users, "pic");
    const [t] = await db
        .select({
            id: issues.id,
            item: issues.item,
            severity: issues.severity,
            status: issues.status,
            tindakLanjut: issues.tindakLanjut,
            targetSelesai: issues.targetSelesai,
            selesaiPada: issues.selesaiPada,
            createdAt: issues.createdAt,
            inspectionId: issues.inspectionId,
            picUserId: issues.picUserId,
            pic: pic.name,
            asetId: assets.id,
            asetKode: assets.kode,
            asetLokasi: assets.lokasiTeks,
            asetGedung: assets.gedung,
            asetLantai: assets.lantai,
        })
        .from(issues)
        .innerJoin(assets, eq(assets.id, issues.assetId))
        .leftJoin(pic, eq(pic.id, issues.picUserId))
        .where(eq(issues.id, id));
    if (!t) return null;
    const jejak = await db
        .select({
            id: issueEvents.id,
            aksi: issueEvents.aksi,
            dari: issueEvents.dari,
            ke: issueEvents.ke,
            createdAt: issueEvents.createdAt,
            oleh: users.name,
        })
        .from(issueEvents)
        .leftJoin(users, eq(users.id, issueEvents.userId))
        .where(eq(issueEvents.issueId, id))
        .orderBy(desc(issueEvents.createdAt), desc(issueEvents.id));
    return { ...t, jejak };
}

/** Pilihan terkontrol formulir temuan: aset berdasarkan kode, PIC dari akun aktif admin/pemantau/inspektur. */
export async function pilihanTemuan() {
    const [aset, pic] = await Promise.all([
        db
            .select({
                id: assets.id,
                kode: assets.kode,
                lokasiTeks: assets.lokasiTeks,
                gedung: assets.gedung,
                lantai: assets.lantai,
            })
            .from(assets)
            .where(eq(assets.aktif, true))
            .orderBy(asc(assets.kode)),
        db
            .select({ id: users.id, name: users.name, nip: users.nip })
            .from(users)
            .where(eq(users.aktif, true))
            .orderBy(asc(users.name)),
    ]);
    return { aset, pic };
}
