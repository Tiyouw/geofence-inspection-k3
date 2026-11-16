import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { divisions, users } from "@/db/schema";
import { ROLES, type Role } from "@/lib/domain/constants";
import { polaMengandung } from "../lib/pencarian";

export type FilterPengguna = { q?: string; role?: Role; aktif?: "ya" | "tidak" };

export function parseFilterPengguna(sp: Record<string, string | string[] | undefined>): FilterPengguna {
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const role = typeof sp.peran === "string" && (ROLES as readonly string[]).includes(sp.peran) ? (sp.peran as Role) : undefined;
  const aktif = sp.aktif === "ya" || sp.aktif === "tidak" ? sp.aktif : undefined;
  return { q, role, aktif };
}

/** Tidak pernah memilih password_hash. */
export async function daftarPengguna(f: FilterPengguna) {
  return db
    .select({
      id: users.id,
      nip: users.nip,
      name: users.name,
      email: users.email,
      role: users.role,
      jabatan: users.jabatan,
      divisi: divisions.nama,
      aktif: users.aktif,
      isDemo: users.isDemo,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .leftJoin(divisions, eq(divisions.id, users.divisionId))
    .where(
      and(
        f.q
          ? sql`(${users.nip} ilike ${polaMengandung(f.q)} escape '!' or ${users.name} ilike ${polaMengandung(f.q)} escape '!')`
          : undefined,
        f.role ? eq(users.role, f.role) : undefined,
        f.aktif ? eq(users.aktif, f.aktif === "ya") : undefined,
      ),
    )
    .orderBy(asc(users.role), asc(users.name));
}

export async function ambilPengguna(id: number) {
  const [u] = await db
    .select({
      id: users.id,
      nip: users.nip,
      name: users.name,
      email: users.email,
      role: users.role,
      jabatan: users.jabatan,
      divisionId: users.divisionId,
      aktif: users.aktif,
      isDemo: users.isDemo,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));
  return u ?? null;
}

export async function pilihanDivisi() {
  return db.select({ id: divisions.id, nama: divisions.nama }).from(divisions).where(eq(divisions.aktif, true)).orderBy(asc(divisions.nama));
}
