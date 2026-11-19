import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { NAMA_EVENT, pesanUntukSasaran, type Peristiwa, type Sasaran } from "./saluran";

/**
 * Penerbit peristiwa realtime lewat Pusher Channels (ADR K-12), tanpa SDK: REST API bertanda
 * tangan HMAC-SHA256. Tanpa variabel PUSHER_* lapisan ini mati dan klien kembali ke perilaku
 * cache 2 menit + segarkan saat kembali ke aplikasi.
 *
 * PUSHER_HOST / PUSHER_WS_URL hanya untuk peladen tiruan di E2E (e2e/realtime-tiruan.mjs).
 */
type Konfigurasi = { appId: string; key: string; secret: string; api: string; ws: string };

function konfigurasi(): Konfigurasi | null {
    const { PUSHER_APP_ID: appId, PUSHER_KEY: key, PUSHER_SECRET: secret, PUSHER_CLUSTER: cluster } = process.env;
    const host = process.env.PUSHER_HOST || undefined;
    if (!appId || !key || !secret || !(cluster || host)) return null;
    return {
        appId,
        key,
        secret,
        api: (host ?? `https://api-${cluster}.pusher.com`).replace(/\/$/, ""),
        ws: (process.env.PUSHER_WS_URL || `wss://ws-${cluster}.pusher.com`).replace(/\/$/, ""),
    };
}

/** Yang boleh diketahui peramban: kunci publik dan alamat WebSocket. Rahasia tidak pernah keluar. */
export type KonfigurasiKlienRealtime = { key: string; ws: string };

export function konfigurasiKlien(): KonfigurasiKlienRealtime | null {
    const k = konfigurasi();
    return k ? { key: k.key, ws: k.ws } : null;
}

const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

const POLA_SOCKET = /^\d+\.\d+$/;

/** Tanda tangan langganan saluran privat, terikat pada satu sambungan (socket_id). */
export function tandaTanganSaluran(socketId: string, saluran: string): string | null {
    const k = konfigurasi();
    if (!k || !POLA_SOCKET.test(socketId)) return null;
    return `${k.key}:${hmac(k.secret, `${socketId}:${saluran}`)}`;
}

/** Untuk peladen tiruan dan uji: periksa tanda tangan dengan rahasia yang sama. */
export function tandaTanganSah(secret: string, key: string, socketId: string, saluran: string, auth: string): boolean {
    const harap = Buffer.from(`${key}:${hmac(secret, `${socketId}:${saluran}`)}`);
    const ada = Buffer.from(auth);
    return harap.length === ada.length && timingSafeEqual(harap, ada);
}

/** Permintaan REST bertanda tangan (protokol Pusher HTTP API, auth_version 1.0). */
export function permintaanBertanda(
    k: Pick<Konfigurasi, "appId" | "key" | "secret">,
    jalurAkhir: string,
    body: string,
    detik = Math.floor(Date.now() / 1000),
) {
    const jalur = `/apps/${k.appId}/${jalurAkhir}`;
    const param: Record<string, string> = {
        auth_key: k.key,
        auth_timestamp: String(detik),
        auth_version: "1.0",
        body_md5: createHash("md5").update(body).digest("hex"),
    };
    const query = Object.keys(param)
        .sort()
        .map((n) => `${n}=${param[n]}`)
        .join("&");
    return { jalur, query: `${query}&auth_signature=${hmac(k.secret, `POST\n${jalur}\n${query}`)}` };
}

async function kirim(k: Konfigurasi, p: Peristiwa, s: Sasaran): Promise<void> {
    const pesan = pesanUntukSasaran(p, s);
    for (let i = 0; i < pesan.length; i += 10) {
        const body = JSON.stringify({
            batch: pesan
                .slice(i, i + 10)
                .map((m) => ({ name: NAMA_EVENT, channel: m.saluran, data: JSON.stringify(m.data) })),
        });
        const { jalur, query } = permintaanBertanda(k, "batch_events", body);
        const res = await fetch(`${k.api}${jalur}?${query}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) throw new Error(`realtime ${res.status}`);
    }
}

/**
 * Terbitkan peristiwa setelah jawaban dikirim (after), jadi tidak menambah waktu aksi dan
 * transaksi sudah selesai saat klien lain menyegarkan. Gagal terbit hanya dicatat: klien
 * tetap punya jalur cadangan (segarkan berkala dan saat kembali ke aplikasi).
 */
export function terbitkan(p: Peristiwa, s: Sasaran): void {
    const k = konfigurasi();
    if (!k) return;
    const kerja = () => kirim(k, p, s).catch((e) => console.warn("[realtime] gagal terbit", p.t, (e as Error).message));
    try {
        after(kerja);
    } catch {
        // Di luar lingkup permintaan (skrip, uji): kirim langsung.
        void kerja();
    }
}
