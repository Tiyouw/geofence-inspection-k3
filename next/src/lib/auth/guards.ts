import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/lib/domain/constants";
import { auth } from "./index";
import { homeFor } from "./access";

export type SessionUser = {
  id: number;
  name: string;
  nip: string;
  role: Role;
  jabatan: string | null;
  divisionId: number | null;
};

/**
 * Pengguna saat ini, dibaca ulang dari basis data (sekali per permintaan).
 * Peran dan status aktif diambil dari DB, bukan dari token, supaya akun yang
 * dinonaktifkan atau diubah perannya langsung berlaku tanpa menunggu token kedaluwarsa.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!id) return null;
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      nip: users.nip,
      role: users.role,
      jabatan: users.jabatan,
      divisionId: users.divisionId,
      aktif: users.aktif,
      sesiVersi: users.sesiVersi,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!u || !u.aktif) return null;
  // Sandi diganti, peran diubah, atau akun dinonaktifkan sesudah token ini terbit: sesi berakhir.
  if ((session?.user?.sesiVersi ?? 0) < u.sesiVersi) return null;
  return { id: u.id, name: u.name, nip: u.nip, role: u.role, jabatan: u.jabatan, divisionId: u.divisionId };
});

/** Halaman/aksi yang butuh login. Tanpa sesi: ke /masuk. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  return user;
}

/**
 * Halaman yang butuh peran tertentu. Peran lain diarahkan ke beranda perannya
 * (seperti middleware PastikanInspektur/PastikanPengelola di Laravel).
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** Dilempar assertRole. Route Handler dapat menangkapnya dan membalas 401/403. */
export class AksesDitolak extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Belum masuk" : "Akses ditolak");
    this.name = "AksesDitolak";
  }
}

/**
 * Untuk Server Action dan Route Handler: tidak mengarahkan, tapi melempar AksesDitolak.
 * Pakai di SETIAP aksi yang mengubah data; proxy saja tidak cukup.
 */
export async function assertRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AksesDitolak(401);
  if (!roles.includes(user.role)) throw new AksesDitolak(403);
  return user;
}
