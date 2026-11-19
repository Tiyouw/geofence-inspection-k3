import { getCurrentUser } from "@/lib/auth/guards";
import { bolehBerlangganan } from "@/lib/realtime/saluran";
import { tandaTanganSaluran } from "@/lib/realtime/server";

/**
 * Otorisasi langganan saluran privat (ADR K-12). Pengguna dibaca ulang dari DB (akun nonaktif atau
 * peran berubah langsung ditolak), saluran yang boleh dihitung dari peran dan unit di DB, dan
 * tanda tangan terikat pada satu sambungan WebSocket (socket_id), jadi tidak bisa dipakai ulang.
 */
export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return Response.json({ galat: "Belum masuk" }, { status: 401 });
    let socketId = "";
    let saluran = "";
    try {
        const body = (await req.json()) as { socket_id?: unknown; channel_name?: unknown };
        socketId = typeof body.socket_id === "string" ? body.socket_id : "";
        saluran = typeof body.channel_name === "string" ? body.channel_name : "";
    } catch {
        return Response.json({ galat: "Isi permintaan bukan JSON" }, { status: 400 });
    }
    if (!bolehBerlangganan(user, saluran)) return Response.json({ galat: "Akses ditolak" }, { status: 403 });
    const auth = tandaTanganSaluran(socketId, saluran);
    if (!auth) return Response.json({ galat: "Realtime tidak aktif" }, { status: 404 });
    return Response.json({ auth }, { headers: { "cache-control": "no-store" } });
}
