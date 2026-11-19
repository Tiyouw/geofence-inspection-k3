/**
 * Seed ulang di basis data yang sudah berisi data pemilik tidak boleh menimpa apa pun
 * (audit 19 Nov 2026): aset (titik, keterangan, atribut), sandi akun demo, dan akun petugas.
 * Dilewati bila DATABASE_URL tidak ada; di CI berjalan di job check (Postgres, sudah di-seed).
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("seed ulang aman untuk data pemilik (integrasi)", async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    it("aset, sandi akun demo, dan akun petugas yang sudah ada tidak diubah", { timeout: 180_000 }, async () => {
        const asetKode = ["35D", "P3K-01", "HB-01"];
        const sebelum = await pool.query(
            "select id, kode, lat, lng, lokasi_teks, attributes from assets where kode = any($1) order by kode",
            [asetKode],
        );
        expect(sebelum.rows.length).toBeGreaterThan(0);
        const akun = await pool.query(
            "select nip, password_hash, name from users where nip in ('admin', '1001') order by nip",
        );
        try {
            // Pemilik memindahkan aset, mengubah keterangan dan atribut, dan mengganti sandi.
            await pool.query(
                "update assets set lat = lat + 0.001, lokasi_teks = lokasi_teks || ' (dipindah pemilik)', attributes = attributes || '{\"uji_seed\": true}'::jsonb where kode = any($1)",
                [asetKode],
            );
            await pool.query(
                "update users set password_hash = 'hash-milik-pemilik', name = name || ' (diubah)' where nip in ('admin', '1001')",
            );
            const diubah = await pool.query(
                "select id, kode, lat, lng, lokasi_teks, attributes from assets where kode = any($1) order by kode",
                [asetKode],
            );

            execFileSync("pnpm", ["exec", "tsx", "src/db/seed/index.ts"], { env: process.env, stdio: "pipe" });

            const sesudah = await pool.query(
                "select id, kode, lat, lng, lokasi_teks, attributes from assets where kode = any($1) order by kode",
                [asetKode],
            );
            expect(sesudah.rows).toEqual(diubah.rows);
            const akunSesudah = await pool.query(
                "select nip, password_hash, name from users where nip in ('admin', '1001') order by nip",
            );
            for (const a of akunSesudah.rows) {
                expect(a.password_hash).toBe("hash-milik-pemilik");
                expect(a.name).toMatch(/\(diubah\)$/);
            }
        } finally {
            for (const r of sebelum.rows) {
                await pool.query(
                    "update assets set lat = $2, lng = $3, lokasi_teks = $4, attributes = $5 where id = $1",
                    [r.id, r.lat, r.lng, r.lokasi_teks, r.attributes],
                );
            }
            for (const a of akun.rows)
                await pool.query("update users set password_hash = $2, name = $3 where nip = $1", [
                    a.nip,
                    a.password_hash,
                    a.name,
                ]);
            await pool.end();
        }
    });
});
