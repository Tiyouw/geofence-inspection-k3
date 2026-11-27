import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assetTypes, assets, auditLogs, divisions, inspections, users } from "@/db/schema";
import {
    KATEGORI_AUDIT,
    SEMUA_AWALAN_DIKENAL,
    idRujukan,
    rentangWaktu,
    rujukanKosong,
    type BarisAudit,
    type Rujukan,
    type SaringanAudit,
} from "../lib/audit";

export const PER_HALAMAN_AUDIT = 50;

const awalan = sql<string>`split_part(${auditLogs.aksi}, '.', 1)`;

function syaratSaringan(f: SaringanAudit) {
    const { mulai, akhir } = rentangWaktu(f);
    const kategori = f.kategori ? KATEGORI_AUDIT[f.kategori] : undefined;
    return and(
        kategori
            ? kategori.awalan.length
                ? inArray(awalan, [...kategori.awalan])
                : notInArray(awalan, SEMUA_AWALAN_DIKENAL)
            : undefined,
        f.pengguna ? eq(auditLogs.userId, f.pengguna) : undefined,
        mulai ? gte(auditLogs.createdAt, mulai) : undefined,
        akhir ? lt(auditLogs.createdAt, akhir) : undefined,
    );
}

/** Pengguna yang pernah muncul di jejak, untuk saringan "Oleh". */
export async function penggunaDiJejak(): Promise<{ id: number; nama: string }[]> {
    return db
        .selectDistinct({ id: users.id, nama: users.name })
        .from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(isNotNull(auditLogs.userId))
        .orderBy(asc(users.name), asc(users.id));
}

export async function daftarAudit(f: SaringanAudit, halaman = 1): Promise<{ rows: BarisAudit[]; total: number }> {
    const syarat = syaratSaringan(f);
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
                userId: auditLogs.userId,
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

const labelAset = sql<string>`${assetTypes.nama} || ' ' || ${assets.kode}`;

/** Nama area, aset, pengguna, tipe, dan divisi yang masih ada untuk satu halaman jejak. */
export async function rujukanUntuk(rows: BarisAudit[]): Promise<Rujukan> {
    const ids = idRujukan(rows);
    const r = rujukanKosong();
    const daftar = <T>(s: Set<T>) => [...s];
    await Promise.all([
        ids.area.size &&
            db
                .select({ id: areas.id, nama: areas.nama, aktif: areas.aktif })
                .from(areas)
                .where(inArray(areas.id, daftar(ids.area)))
                .then((xs) => xs.forEach((x) => r.area.set(x.id, { nama: x.nama, aktif: x.aktif }))),
        ids.aset.size &&
            db
                .select({ id: assets.id, label: labelAset })
                .from(assets)
                .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
                .where(inArray(assets.id, daftar(ids.aset)))
                .then((xs) => xs.forEach((x) => r.aset.set(x.id, x.label))),
        ids.inspeksi.size &&
            db
                .select({ id: inspections.id, label: labelAset })
                .from(inspections)
                .innerJoin(assets, eq(assets.id, inspections.assetId))
                .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
                .where(inArray(inspections.id, daftar(ids.inspeksi)))
                .then((xs) => xs.forEach((x) => r.inspeksi.set(x.id, x.label))),
        ids.pengguna.size &&
            db
                .select({ id: users.id, nama: users.name, nip: users.nip })
                .from(users)
                .where(inArray(users.id, daftar(ids.pengguna)))
                .then((xs) => xs.forEach((x) => r.pengguna.set(x.id, { nama: x.nama, nip: x.nip }))),
        ids.tipe.size &&
            db
                .select({ id: assetTypes.id, nama: assetTypes.nama })
                .from(assetTypes)
                .where(inArray(assetTypes.id, daftar(ids.tipe)))
                .then((xs) => xs.forEach((x) => r.tipe.set(x.id, x.nama))),
        ids.divisi.size &&
            db
                .select({ id: divisions.id, nama: divisions.nama })
                .from(divisions)
                .where(inArray(divisions.id, daftar(ids.divisi)))
                .then((xs) => xs.forEach((x) => r.divisi.set(x.id, x.nama))),
    ]);
    return r;
}
