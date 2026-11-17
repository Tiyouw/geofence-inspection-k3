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

/** Inspeksi final di antrean tinjauan (perlu tinjauan, belum ditinjau), dengan satu foto yang ditautkan ke butir 1. */
export async function buatInspeksiAntre(
    gate: "perlu_tinjauan" | "perlu_review" | "jauh" | "gps_lemah" | "tanpa_gps" | "sesuai" = "perlu_tinjauan",
    opsi: { alasan?: "di_luar_gedung" | "gps_lemah"; terbatas?: boolean } = { alasan: "di_luar_gedung" },
) {
    const c = db();
    const inspektur = await idPengguna("inspektur");
    const aset = await c.query<{ id: number; kode: string }>(
        "select a.id, a.kode from assets a join asset_types t on t.id = a.asset_type_id where t.slug = 'apar' and a.aktif order by random() limit 1",
    );
    const { id: assetId, kode } = aset.rows[0]!;
    const id = randomUUID();
    // Dimundurkan 45 hari: tetap di antrean (antrean tidak dibatasi periode), tetapi tidak menjadi
    // "inspeksi final terbaru" yang dipakai uji lain (mis. e2e/pemantau) sebagai contoh lengkap.
    const sekarang = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await c.query(
        `insert into inspections (id, asset_id, user_id, status, inspected_at, mulai_pada, durasi_detik, gps_lat, gps_lng, gps_accuracy,
       jarak_m, gate_status, gate_alasan, restricted_area, qr_verified, kesimpulan, received_at)
     values ($1, $2, $3, 'final', $4, $5, 30, -7.2, 112.7, 15, 140, $6, $7, $8, true, 'layak', $4)`,
        [
            id,
            assetId,
            inspektur,
            sekarang,
            new Date(sekarang.getTime() - 30_000),
            gate,
            opsi.alasan ?? null,
            opsi.terbatas ?? false,
        ],
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
    const butir = await c.query<{ id: number; label: string }>(
        `select i.id, i.label from checklist_items i join checklist_groups g on g.id = i.checklist_group_id
          join assets a on a.asset_type_id = g.asset_type_id where a.id = $1 order by i.urut limit 1`,
        [assetId],
    );
    await c.query("insert into inspection_answers (inspection_id, checklist_item_id, nilai) values ($1, $2, 'ok')", [
        id,
        butir.rows[0]!.id,
    ]);
    await c.query("insert into inspection_photo_items (photo_id, checklist_item_id) values ($1, $2)", [
        fotoId,
        butir.rows[0]!.id,
    ]);
    return { id, kode, fotoId, butir: butir.rows[0]!.label };
}

/** Temuan baru (bentuk v2: lokasi dan tindakan) pada aset APAR acak, lahir dari inspeksi final. */
export async function buatTemuan(
    severity: "berat" | "sedang" | "ringan" = "berat",
    item = `Temuan uji ${Date.now().toString(36)}`,
) {
    const c = db();
    const aset = await c.query<{ id: number; kode: string }>(
        "select a.id, a.kode from assets a join asset_types t on t.id = a.asset_type_id where t.slug = 'apar' and a.aktif order by random() limit 1",
    );
    const inspId = randomUUID();
    await c.query(
        `insert into inspections (id, asset_id, user_id, status, inspected_at, gate_status, qr_verified, kesimpulan)
         values ($1, $2, $3, 'final', now() - interval '60 days', 'sesuai', true, 'layak_catatan')`,
        [inspId, aset.rows[0]!.id, await idPengguna("inspektur")],
    );
    const r = await c.query<{ id: number }>(
        `insert into issues (asset_id, inspection_id, item, severity, lokasi, tindakan_rekomendasi, uraian_tindakan)
         values ($1, $2, $3, $4, 'Gedung Uji · Lorong', 'ganti', 'Pasang unit cadangan') returning id`,
        [aset.rows[0]!.id, inspId, item, severity],
    );
    return { id: r.rows[0]!.id, item, kode: aset.rows[0]!.kode };
}

export async function baris<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const r = await db().query(sql, params);
    return r.rows as T[];
}
