import { Pool } from "pg";

let pool: Pool | null = null;
const p = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }));

export async function q<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await p().query<T>(sql, params)).rows;
}

/** Aset APAR aktif menurut kode, beserta tokennya (hanya untuk uji; token tidak pernah keluar dari peladen). */
export async function aset(kode: string) {
  const [a] = await q<{ id: number; token: string; lat: string; lng: string }>(
    "select id, qr_token as token, lat, lng from assets where kode = $1",
    [kode],
  );
  if (!a) throw new Error(`aset ${kode} tidak ada; jalankan pnpm db:seed`);
  return { id: a.id, token: a.token, lat: Number(a.lat), lng: Number(a.lng) };
}

export async function tutup() {
  await pool?.end();
  pool = null;
}
