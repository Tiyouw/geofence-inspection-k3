/**
 * Penempatan ulang SEMUA aset aktif ke dalam kawasan galangan yang disetujui (keputusan pemilik
 * 19 Nov 2026). Aturan per modul: src/lib/geo/penempatan.ts.
 *
 *   DATABASE_URL=… pnpm exec tsx scripts/penempatan-aset.ts rencana  --keluaran <folder>
 *   DATABASE_URL=… pnpm exec tsx scripts/penempatan-aset.ts terapkan --keluaran <folder>
 *   DATABASE_URL=… pnpm exec tsx scripts/penempatan-aset.ts pulihkan <folder>/cadangan-….json
 *
 * - rencana: hanya membaca; menulis cadangan (lat, lng, area, gedung lama) dan rencana ke <folder>.
 * - terapkan: rencana yang sama dalam SATU transaksi; batal bila ada aset yang tidak mendapat tempat
 *   atau datanya berubah sejak dibaca; satu baris jejak audit dalam kalimat biasa.
 * - pulihkan: kembalikan lat/lng/area/gedung dari berkas cadangan, satu transaksi, plus jejak audit.
 * Hanya kolom assets.lat, lng, area_id, gedung yang berubah. Kode, jadwal, inspeksi, dan riwayat
 * tidak disentuh. <folder> memuat koordinat denah asli: simpan di luar repo, jangan di-commit.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import type { GeometriArea } from "../src/lib/geo/geometri";
import { type AsetTempat, type Bangunan, bangunanDalam, rencanaPenempatan } from "../src/lib/geo/penempatan";
import type { AssetTypeSlug } from "../src/lib/domain/constants";

type Cadangan = {
    id: number;
    kode: string;
    lat: number | null;
    lng: number | null;
    area_id: number | null;
    gedung: string | null;
};

const [perintah, ...arg] = process.argv.slice(2);
const opsi = (k: string) => {
    const i = arg.indexOf(k);
    return i >= 0 ? arg[i + 1] : undefined;
};
const url = process.env.DATABASE_URL;
if (!url || !["rencana", "terapkan", "pulihkan"].includes(perintah ?? "")) {
    console.error(
        "Pakai: penempatan-aset.ts rencana|terapkan --keluaran <folder> | pulihkan <cadangan.json>; DATABASE_URL wajib.",
    );
    process.exit(2);
}

const c = new Client({ connectionString: url });

async function bacaDenah() {
    const kawasan = (
        await c.query<{ polygon: GeometriArea }>(
            "select polygon from areas where aktif and jenis='kawasan' and polygon is not null and kode not like 'DEMO-%' order by id limit 1",
        )
    ).rows[0]?.polygon;
    if (!kawasan) throw new Error("Belum ada kawasan non-demo yang disetujui.");
    const bangunan: Bangunan[] = (
        await c.query<{ id: number; nama: string; polygon: GeometriArea; restricted: boolean }>(
            "select id, nama, polygon, restricted from areas where aktif and polygon is not null and jenis <> 'kawasan' and kode not like 'DEMO-%' order by id",
        )
    ).rows;
    return { kawasan, bangunan };
}

async function bacaAset() {
    return (
        await c.query<{
            id: number;
            kode: string;
            slug: AssetTypeSlug;
            lat: string | null;
            lng: string | null;
            area_id: number | null;
            gedung: string | null;
            lokasi_teks: string;
            lantai: string | null;
            area_nama: string | null;
            restricted: boolean | null;
        }>(
            `select a.id, a.kode, t.slug, a.lat, a.lng, a.area_id, a.gedung, a.lokasi_teks, a.lantai, ar.nama area_nama, ar.restricted
         from assets a join asset_types t on t.id = a.asset_type_id left join areas ar on ar.id = a.area_id
        where a.aktif order by a.id`,
        )
    ).rows;
}

const angka = (v: string | null) => (v === null ? null : Number(v));

async function rencana() {
    const denah = await bacaDenah();
    const dalam = new Map(bangunanDalam(denah).map((b) => [b.id, b]));
    const rows = await bacaAset();
    const aset: AsetTempat[] = rows.map((r) => ({
        id: r.id,
        kode: r.kode,
        slug: r.slug,
        kelompok: r.area_nama ?? r.gedung,
        lokasiTeks: r.lokasi_teks ?? "",
        lantai: r.lantai,
        areaTetap: r.area_id !== null ? (dalam.get(r.area_id) ?? null) : null,
        terbatas: r.restricted === true,
    }));
    const tempat = rencanaPenempatan(aset, denah);
    const tanpa = rows.filter((r) => !tempat.has(r.id)).map((r) => r.kode);
    if (tanpa.length) throw new Error(`Tidak mendapat tempat: ${tanpa.join(", ")}. Tidak ada yang diubah.`);
    const cadangan: Cadangan[] = rows.map((r) => ({
        id: r.id,
        kode: r.kode,
        lat: angka(r.lat),
        lng: angka(r.lng),
        area_id: r.area_id,
        gedung: r.gedung,
    }));
    const baru = rows.map((r) => {
        const t = tempat.get(r.id)!;
        return {
            id: r.id,
            kode: r.kode,
            slug: r.slug,
            lat: t.lat,
            lng: t.lng,
            area_id: t.areaId,
            // Objek bergerak: teks gedung lama dipertahankan (tidak berarea).
            gedung: t.namaArea ?? r.gedung,
            dari: r.area_nama ?? r.gedung ?? "(tanpa area)",
        };
    });
    const perGedung: Record<string, number> = {};
    for (const b of baru) {
        const k = b.area_id === null ? "(terbuka, tanpa area: mobil pemadam)" : b.gedung!;
        perGedung[k] = (perGedung[k] ?? 0) + 1;
    }
    return { cadangan, baru, perGedung };
}

async function audit(aksi: string, data: Record<string, unknown>) {
    const [admin] = (await c.query<{ id: number }>("select id from users where nip = 'admin' limit 1")).rows;
    await c.query(
        "insert into audit_logs (user_id, aksi, entitas, entitas_id, data) values ($1, $2, 'asset', '-', $3)",
        [admin?.id ?? null, aksi, JSON.stringify(data)],
    );
}

async function utama() {
    await c.connect();
    try {
        if (perintah === "pulihkan") {
            const berkas = arg[0];
            if (!berkas) throw new Error("Sebutkan berkas cadangan.");
            const cadangan = JSON.parse(readFileSync(berkas, "utf8")) as Cadangan[];
            await c.query("begin");
            for (const r of cadangan) {
                await c.query(
                    "update assets set lat = $2, lng = $3, area_id = $4, gedung = $5, updated_at = now() where id = $1",
                    [r.id, r.lat, r.lng, r.area_id, r.gedung],
                );
            }
            await audit("aset.pulihkan_tempat", { jumlah: cadangan.length, cadangan: berkas.split(/[\\/]/).pop() });
            await c.query("commit");
            console.log(`Dipulihkan: ${cadangan.length} aset dari ${berkas}.`);
        } else {
            const folder = opsi("--keluaran");
            if (!folder) throw new Error("--keluaran <folder> wajib (di luar repo: berisi koordinat denah asli).");
            mkdirSync(folder, { recursive: true });
            await c.query(perintah === "rencana" ? "begin transaction read only" : "begin");
            if (perintah === "terapkan") await c.query("lock table assets in share row exclusive mode");
            const r = await rencana();
            const cap = new Date().toISOString().replace(/[:.]/g, "-");
            const fCadangan = join(folder, `cadangan-${cap}.json`);
            writeFileSync(fCadangan, JSON.stringify(r.cadangan, null, 1));
            writeFileSync(
                join(folder, `rencana-${cap}.json`),
                JSON.stringify({ perGedung: r.perGedung, aset: r.baru }, null, 1),
            );
            console.log(`Aset: ${r.baru.length}. Cadangan: ${fCadangan}`);
            console.table(
                Object.entries(r.perGedung)
                    .sort((a, b) => b[1] - a[1])
                    .map(([gedung, n]) => ({ gedung, aset: n })),
            );
            console.table(
                r.baru
                    .filter((_, i) => i % Math.max(1, Math.floor(r.baru.length / 10)) === 0)
                    .slice(0, 10)
                    .map((b) => ({ kode: b.kode, modul: b.slug, dari: b.dari, ke: b.gedung })),
            );
            if (perintah === "terapkan") {
                for (const b of r.baru) {
                    await c.query(
                        "update assets set lat = $2, lng = $3, area_id = $4, gedung = $5, updated_at = now() where id = $1",
                        [b.id, b.lat, b.lng, b.area_id, b.gedung],
                    );
                }
                await audit("aset.tempatkan_ulang", {
                    jumlah: r.baru.length,
                    perGedung: r.perGedung,
                    alasan: "titik lama di luar galangan; keputusan pemilik 19 Nov 2026",
                    cadangan: fCadangan.split(/[\\/]/).pop(),
                });
                await c.query("commit");
                console.log(`Diterapkan: ${r.baru.length} aset. Pulihkan dengan: pulihkan ${fCadangan}`);
            } else {
                await c.query("rollback");
                console.log("RENCANA: tidak ada yang diubah.");
            }
        }
    } catch (e) {
        await c.query("rollback").catch(() => {});
        console.error((e as Error).message || String(e));
        process.exitCode = 1;
    } finally {
        await c.end();
    }
}

void utama();
