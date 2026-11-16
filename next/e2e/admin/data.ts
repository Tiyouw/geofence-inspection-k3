/**
 * Data uji E2E Admin, ditulis langsung ke Postgres uji (DATABASE_URL) supaya setiap uji punya
 * entri antrean sendiri dan bisa diulang. Tidak pernah menulis token QR.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Pool } from "pg";

let pool: Pool | null = null;
function db(): Pool {
    pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    return pool;
}

/** JPEG 1x1 yang sah. */
const JPEG = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
);

export async function idPengguna(nip: string): Promise<number> {
    const r = await db().query<{ id: number }>("select id from users where nip = $1", [nip]);
    return r.rows[0]!.id;
}

/** Inspeksi final di antrean tinjauan (gerbang menyimpang, belum ditinjau), dengan satu foto. */
export async function buatInspeksiAntre(gate: "perlu_review" | "jauh" | "gps_lemah" | "tanpa_gps" = "perlu_review") {
    const c = db();
    const inspektur = await idPengguna("inspektur");
    const aset = await c.query<{ id: number; kode: string }>(
        "select a.id, a.kode from assets a join asset_types t on t.id = a.asset_type_id where t.slug = 'apar' and a.aktif order by random() limit 1",
    );
    const { id: assetId, kode } = aset.rows[0]!;
    const id = randomUUID();
    const sekarang = new Date();
    await c.query(
        `insert into inspections (id, asset_id, user_id, status, inspected_at, mulai_pada, durasi_detik, gps_lat, gps_lng, gps_accuracy,
       jarak_m, gate_status, qr_verified, kesimpulan, received_at)
     values ($1, $2, $3, 'final', $4, $5, 30, -7.2, 112.7, 15, 140, $6, true, 'layak', $4)`,
        [id, assetId, inspektur, sekarang, new Date(sekarang.getTime() - 30_000), gate],
    );
    const fotoId = randomUUID();
    const key = `inspeksi/${id}/${fotoId}.jpg`;
    const path = join(process.cwd(), ".data", "foto", key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JPEG);
    await c.query(
        "insert into inspection_photos (id, inspection_id, storage_key, sha256, content_type, bytes) values ($1, $2, $3, $4, 'image/jpeg', $5)",
        [fotoId, id, key, "0".repeat(64), JPEG.byteLength],
    );
    return { id, kode, fotoId };
}

/** Temuan terbuka baru pada aset APAR acak. */
export async function buatTemuan(
    severity: "berat" | "sedang" | "ringan" = "berat",
    item = `Temuan uji ${Date.now().toString(36)}`,
) {
    const c = db();
    const aset = await c.query<{ id: number; kode: string }>(
        "select a.id, a.kode from assets a join asset_types t on t.id = a.asset_type_id where t.slug = 'apar' and a.aktif order by random() limit 1",
    );
    const r = await c.query<{ id: number }>(
        "insert into issues (asset_id, item, severity, status) values ($1, $2, $3, 'terbuka') returning id",
        [aset.rows[0]!.id, item, severity],
    );
    return { id: r.rows[0]!.id, item, kode: aset.rows[0]!.kode };
}

export async function baris<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const r = await db().query(sql, params);
    return r.rows as T[];
}
