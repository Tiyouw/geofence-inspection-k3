import { getCurrentUser } from "@/lib/auth/guards";
import { saluranUntuk } from "@/lib/realtime/saluran";
import { tokenLangganan } from "@/lib/realtime/server";

/**
 * Token langganan realtime (ADR K-12): JWT Ably berumur pendek untuk pengguna yang masuk.
 * Pengguna dibaca ulang dari DB (akun nonaktif atau peran berubah langsung ditolak) dan saluran
 * dihitung dari peran/unit di DB, bukan dari permintaan klien. SDK Ably memanggil rute ini
 * (authUrl) saat menyambung dan sebelum token kedaluwarsa.
 */
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return Response.json({ galat: "Belum masuk" }, { status: 401 });
    const token = tokenLangganan(user.id, saluranUntuk(user));
    if (!token) return Response.json({ galat: "Realtime tidak aktif" }, { status: 404 });
    return new Response(token, { headers: { "content-type": "application/jwt", "cache-control": "no-store" } });
}
