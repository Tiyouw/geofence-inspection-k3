import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, inspections, issues, users } from "@/db/schema";
import { LABEL_KESIMPULAN, type Role } from "@/lib/domain/constants";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatWaktu } from "@/lib/format";
import {
    MAKS_PER_KELOMPOK,
    MAKS_SARAN_HALAMAN,
    MIN_HURUF,
    cocok,
    halamanUntuk,
    polaMengandung,
    tindakanUntuk,
    type HasilCari,
    type KelompokCari,
} from "../lib/pencarian";
import { LABEL_SEVERITY } from "../lib/temuan";

/**
 * Pencarian Ctrl+K (SPEC §4.8). Hanya membaca. qr_token TIDAK PERNAH dipilih, dicari,
 * atau ditampilkan (K6). Aset dan tindakan hanya untuk admin (K5).
 */
export async function cariPanel(qMentah: string, role: Role): Promise<KelompokCari[]> {
    const q = qMentah.trim().slice(0, 100);
    const admin = role === "admin";

    if (q.length < MIN_HURUF) {
        return buang([
            { nama: "Halaman", hasil: halamanUntuk(role).slice(0, MAKS_SARAN_HALAMAN) },
            { nama: "Tindakan", hasil: tindakanUntuk(role) },
            { nama: "Inspeksi terbaru", hasil: await inspeksi(null, role, 3) },
        ]);
    }

    const pola = polaMengandung(q);
    const [aset, temuan, insp] = await Promise.all([
        admin ? cariAset(pola) : Promise.resolve([]),
        cariTemuan(pola, role),
        inspeksi(pola, role, MAKS_PER_KELOMPOK),
    ]);
    return buang([
        {
            nama: "Halaman",
            hasil: halamanUntuk(role)
                .filter((h) => cocok(h.judul, q))
                .slice(0, MAKS_PER_KELOMPOK),
        },
        {
            nama: "Tindakan",
            hasil: tindakanUntuk(role)
                .filter((h) => cocok(h.judul, q))
                .slice(0, MAKS_PER_KELOMPOK),
        },
        { nama: "Aset", hasil: aset },
        { nama: "Temuan", hasil: temuan },
        { nama: "Inspeksi", hasil: insp },
    ]);
}

const buang = (k: KelompokCari[]) => k.filter((g) => g.hasil.length > 0);

async function cariAset(pola: string): Promise<HasilCari[]> {
    const rows = await db
        .select({
            id: assets.id,
            kode: assets.kode,
            gedung: assets.gedung,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            aktif: assets.aktif,
        })
        .from(assets)
        .where(
            sql`(${assets.kode} ilike ${pola} escape '!' or coalesce(${assets.gedung}, '') ilike ${pola} escape '!'
        or coalesce(${assets.lantai}, '') ilike ${pola} escape '!' or ${assets.lokasiTeks} ilike ${pola} escape '!')`,
        )
        .orderBy(desc(assets.aktif), assets.kode)
        .limit(MAKS_PER_KELOMPOK);
    return rows.map((a) => ({
        judul: `${a.kode} · ${labelLokasi(a)}`,
        rincian: [a.gedung, a.aktif ? null : "Nonaktif"].filter(Boolean).join(" · ") || undefined,
        href: `/admin/aset/${a.id}`,
    }));
}

async function cariTemuan(pola: string, role: Role): Promise<HasilCari[]> {
    const rows = await db
        .select({
            id: issues.id,
            item: issues.item,
            severity: issues.severity,
            kode: assets.kode,
        })
        .from(issues)
        .innerJoin(assets, eq(assets.id, issues.assetId))
        .where(sql`(${issues.item} ilike ${pola} escape '!' or ${assets.kode} ilike ${pola} escape '!')`)
        .orderBy(desc(issues.createdAt))
        .limit(MAKS_PER_KELOMPOK);
    return rows.map((t) => ({
        judul: `${t.kode}: ${t.item}`,
        rincian: `Temuan ${LABEL_SEVERITY[t.severity].toLowerCase()}`,
        href: role === "admin" ? `/admin/temuan/${t.id}` : `/pemantau/temuan/${t.id}`,
    }));
}

/** pola null = saran: hanya final terbaru (tanpa draf, K2). */
async function inspeksi(pola: string | null, role: Role, batas: number): Promise<HasilCari[]> {
    const rows = await db
        .select({
            id: inspections.id,
            status: inspections.status,
            inspectedAt: inspections.inspectedAt,
            kesimpulan: inspections.kesimpulan,
            kode: assets.kode,
            petugas: users.name,
        })
        .from(inspections)
        .innerJoin(assets, eq(assets.id, inspections.assetId))
        .innerJoin(users, eq(users.id, inspections.userId))
        .where(
            pola === null
                ? eq(inspections.status, "final")
                : sql`(${assets.kode} ilike ${pola} escape '!' or ${users.name} ilike ${pola} escape '!')`,
        )
        .orderBy(
            sql`case ${inspections.status} when 'final' then 0 else 1 end`,
            sql`${inspections.inspectedAt} desc nulls last`,
        )
        .limit(batas);
    return rows.map((i) => ({
        judul: `Inspeksi ${i.kode}`,
        rincian: [
            i.petugas,
            i.status === "final" ? formatWaktu(i.inspectedAt) : "Draf",
            i.kesimpulan ? LABEL_KESIMPULAN[i.kesimpulan] : null,
        ]
            .filter(Boolean)
            .join(" · "),
        href: role === "admin" ? `/admin/tinjauan/${i.id}` : "/pemantau",
    }));
}
