"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { masukDenganPeran } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeRedirect } from "@/lib/auth/access";
import type { Role } from "@/lib/domain/constants";

/**
 * Hasil masuk. Dengan JavaScript (field `js`), peran dan tujuan dikembalikan supaya klien
 * menampilkan animasi deteksi peran lalu berpindah halaman; peran SELALU dari peladen.
 * Tanpa JavaScript, peladen langsung mengalihkan.
 */
export type MasukState = { error?: string; nip?: string; role?: Role; tujuan?: string };

const schema = z.object({
    nip: z.string().trim().min(1, "NIP wajib diisi.").max(32),
    password: z.string().min(1, "Kata sandi wajib diisi."),
    callbackUrl: z.string().optional(),
    js: z.string().optional(),
});

export async function masuk(_prev: MasukState, formData: FormData): Promise<MasukState> {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    const nip = String(formData.get("nip") ?? "");
    if (!parsed.success) return { error: parsed.error.issues[0]?.message, nip };

    let role: Role | null;
    try {
        role = await masukDenganPeran(parsed.data.nip, parsed.data.password);
    } catch (e) {
        if (e instanceof AuthError) {
            const code = (e as AuthError & { code?: string }).code ?? "";
            if (code.startsWith("throttled:")) {
                return { error: `Terlalu banyak percobaan. Coba lagi dalam ${code.slice(10)} detik.`, nip };
            }
            // Pesan disatukan supaya tidak membocorkan apakah NIP terdaftar (SPEC §1.2).
            return { error: "NIP atau kata sandi tidak cocok, atau akun sudah tidak aktif.", nip };
        }
        throw e;
    }

    // Cookie sesi baru belum terbaca pada permintaan ini. Peran dari authorize pada permintaan
    // yang sama; bila tidak tersedia, dibaca dari DB.
    if (!role) {
        const [user] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.nip, parsed.data.nip.toLowerCase()))
            .limit(1);
        if (!user) redirect("/masuk");
        role = user.role;
    }
    const tujuan = safeRedirect(role, parsed.data.callbackUrl);
    if (parsed.data.js === "1") return { role, tujuan };
    redirect(tujuan);
}

export async function keluar() {
    const { signOut } = await import("@/lib/auth");
    await signOut({ redirectTo: "/masuk?keluar=1" });
}
