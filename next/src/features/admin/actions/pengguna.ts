"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { buatSandiAcak } from "../lib/sandi";
import { skemaPengguna } from "../lib/skema";
import { aksiAdmin, catatAudit, dariForm, langgarUnik, type HasilAksi } from "../server/aksi";

const BIAYA_BCRYPT = 10;

function galatUnik(e: unknown): HasilAksi<never> | null {
    if (!langgarUnik(e)) return null;
    const constraint = String(
        (e as { cause?: { constraint?: string } })?.cause?.constraint ??
            (e as { constraint?: string })?.constraint ??
            "",
    );
    const kolom = constraint.includes("email") ? "email" : "nip";
    return {
        ok: false,
        status: 422,
        pesan: "Periksa kembali isian yang ditandai.",
        galat: { [kolom]: [kolom === "email" ? "Surel ini sudah dipakai akun lain." : "NIP ini sudah terdaftar."] },
    };
}

function segarkan(id?: number) {
    revalidatePath("/admin/pengguna");
    if (id) revalidatePath(`/admin/pengguna/${id}`);
}

/** Petugas baru (H8): sandi wajib saat buat, disimpan sebagai hash bcrypt. */
export async function buatPengguna(_prev: unknown, fd: FormData): Promise<HasilAksi<{ id: number }>> {
    return aksiAdmin<typeof skemaPengguna, { id: number }>(skemaPengguna, dariForm(fd), async (d, user) => {
        if (!d.password) {
            return {
                ok: false,
                status: 422,
                pesan: "Periksa kembali isian yang ditandai.",
                galat: { password: ["Kata sandi wajib diisi untuk akun baru."] },
            };
        }
        try {
            const id = await db.transaction(async (tx) => {
                const [u] = await tx
                    .insert(users)
                    .values({
                        nip: d.nip,
                        name: d.name,
                        email: d.email,
                        role: d.role,
                        divisionId: d.divisionId,
                        jabatan: d.jabatan,
                        aktif: d.aktif,
                        passwordHash: await bcrypt.hash(d.password!, BIAYA_BCRYPT),
                    })
                    .returning({ id: users.id });
                await catatAudit(tx, user, "pengguna.buat", "user", u!.id, { nip: d.nip, role: d.role });
                return u!.id;
            });
            segarkan();
            return { ok: true, pesan: "Akun tersimpan.", data: { id } };
        } catch (e) {
            const g = galatUnik(e);
            if (g) return g;
            throw e;
        }
    });
}

/**
 * Ubah petugas: sandi kosong = dipertahankan (H8). Admin tidak bisa mengubah peran
 * atau menonaktifkan dirinya sendiri (B9); petugas tidak pernah dihapus.
 */
export async function ubahPengguna(id: number, _prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaPengguna, dariForm(fd), async (d, user) => {
        const [lama] = await db.select({ role: users.role, aktif: users.aktif }).from(users).where(eq(users.id, id));
        if (!lama) return { ok: false, status: 404, pesan: "Akun tidak ditemukan." };
        if (id === user.id && (d.role !== lama.role || !d.aktif)) {
            return { ok: false, status: 403, pesan: "Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri." };
        }
        try {
            await db.transaction(async (tx) => {
                await tx
                    .update(users)
                    .set({
                        nip: d.nip,
                        name: d.name,
                        email: d.email,
                        role: d.role,
                        divisionId: d.divisionId,
                        jabatan: d.jabatan,
                        aktif: d.aktif,
                        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, BIAYA_BCRYPT) } : {}),
                        // Sandi baru, peran lain, atau nonaktif: sesi lama akun itu berakhir.
                        ...(d.password || d.role !== lama.role || (!d.aktif && lama.aktif) ? { sesiVersi: sql`${users.sesiVersi} + 1` } : {}),
                    })
                    .where(eq(users.id, id));
                await catatAudit(tx, user, "pengguna.ubah", "user", id, {
                    nip: d.nip,
                    ...(d.role !== lama.role ? { peran: { dari: lama.role, ke: d.role } } : {}),
                    ...(d.aktif !== lama.aktif ? { aktif: d.aktif } : {}),
                    sandiDiganti: Boolean(d.password),
                });
            });
        } catch (e) {
            const g = galatUnik(e);
            if (g) return g;
            throw e;
        }
        segarkan(id);
        return { ok: true, pesan: "Perubahan tersimpan." };
    });
}

/** Aktifkan/nonaktifkan cepat dari daftar. Nonaktif langsung kehilangan akses (getCurrentUser membaca DB). */
export async function aturAktifPengguna(id: number, aktif: boolean): Promise<HasilAksi> {
    return aksiAdmin(
        z.object({ id: z.number().int().positive(), aktif: z.boolean() }),
        { id, aktif },
        async (d, user) => {
            if (d.id === user.id)
                return { ok: false, status: 403, pesan: "Anda tidak bisa menonaktifkan akun sendiri." };
            const [r] = await db
                .update(users)
                .set({ aktif: d.aktif, ...(d.aktif ? {} : { sesiVersi: sql`${users.sesiVersi} + 1` }) })
                .where(eq(users.id, d.id))
                .returning({ nip: users.nip });
            if (!r) return { ok: false, status: 404, pesan: "Akun tidak ditemukan." };
            await catatAudit(db, user, d.aktif ? "pengguna.aktifkan" : "pengguna.nonaktifkan", "user", d.id, {
                nip: r.nip,
            });
            segarkan(d.id);
            return { ok: true, pesan: d.aktif ? "Akun diaktifkan." : "Akun dinonaktifkan." };
        },
    );
}

/**
 * "Terbitkan sandi baru" (A11, padanan petugas:sandi): sandi acak 14 karakter, tampil SEKALI
 * di respons ini, tersimpan hanya sebagai hash. Sandi tidak pernah dicatat.
 */
export async function terbitkanSandi(id: number): Promise<HasilAksi<{ sandi: string; nip: string }>> {
    return aksiAdmin(z.number().int().positive(), id, async (userId, user) => {
        const sandi = buatSandiAcak();
        const hasil = await db.transaction(async (tx) => {
            const [r] = await tx
                .update(users)
                .set({ passwordHash: await bcrypt.hash(sandi, BIAYA_BCRYPT), sesiVersi: sql`${users.sesiVersi} + 1` })
                .where(eq(users.id, userId))
                .returning({ nip: users.nip });
            if (!r) return null;
            await catatAudit(tx, user, "pengguna.terbitkan_sandi", "user", userId, { nip: r.nip });
            return r;
        });
        if (!hasil) return { ok: false, status: 404, pesan: "Akun tidak ditemukan." };
        return { ok: true, pesan: "Sandi baru diterbitkan.", data: { sandi, nip: hasil.nip } };
    });
}
