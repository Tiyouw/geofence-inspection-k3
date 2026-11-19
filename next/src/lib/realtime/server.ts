import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import {
    NAMA_EVENT,
    kapabilitas,
    pesanUntukSasaran,
    type KonfigurasiKlienRealtime,
    type Peristiwa,
    type Sasaran,
} from "./saluran";

export type { KonfigurasiKlienRealtime };

/**
 * Lapisan realtime lewat Ably (ADR K-12), tanpa SDK di peladen:
 * - terbit: REST batch publish dengan Basic auth kunci API;
 * - langganan: JWT Ably (HS256, ditandatangani rahasia kunci) berumur pendek per pengguna, dengan
 *   kapabilitas "subscribe" hanya untuk saluran peran/unitnya. Ably sendiri yang menolak
 *   langganan di luar kapabilitas.
 *
 * Bendera fitur: tanpa ABLY_API_KEY (atau REALTIME=mati) semuanya mati dan klien kembali ke cache
 * 2 menit + segarkan saat kembali ke aplikasi. ABLY_ENDPOINT/ABLY_PORT/ABLY_TLS hanya untuk peladen
 * tiruan di E2E (e2e/realtime-tiruan.mjs).
 */
type Konfigurasi = { keyName: string; secret: string; rest: string; klien: KonfigurasiKlienRealtime };

/** Umur token langganan. SDK meminta token baru sendiri sebelum kedaluwarsa. */
export const UMUR_TOKEN_S = 60 * 60;

function konfigurasi(): Konfigurasi | null {
    const kunci = process.env.ABLY_API_KEY;
    if (!kunci || process.env.REALTIME === "mati") return null;
    const i = kunci.indexOf(":");
    if (i <= 0) return null;
    const endpoint = process.env.ABLY_ENDPOINT || undefined;
    const port = Number(process.env.ABLY_PORT) || undefined;
    const tls = process.env.ABLY_TLS === "0" ? false : undefined;
    const rest = endpoint
        ? `${tls === false ? "http" : "https"}://${endpoint}${port ? `:${port}` : ""}`
        : "https://rest.ably.io";
    return {
        keyName: kunci.slice(0, i),
        secret: kunci.slice(i + 1),
        rest,
        klien: { ...(endpoint ? { endpoint } : {}), ...(port ? { port } : {}), ...(tls === false ? { tls } : {}) },
    };
}

export function konfigurasiKlien(): KonfigurasiKlienRealtime | null {
    return konfigurasi()?.klien ?? null;
}

const b64url = (b: string) => Buffer.from(b).toString("base64url");

/** JWT Ably: header kid = nama kunci, klaim x-ably-capability (string JSON) dan x-ably-clientId. */
export function buatJwt(
    keyName: string,
    secret: string,
    clientId: string,
    saluran: string[],
    sekarang = Math.floor(Date.now() / 1000),
): string {
    const kepala = b64url(JSON.stringify({ typ: "JWT", alg: "HS256", kid: keyName }));
    const isi = b64url(
        JSON.stringify({
            iat: sekarang,
            exp: sekarang + UMUR_TOKEN_S,
            "x-ably-capability": JSON.stringify(kapabilitas(saluran)),
            "x-ably-clientId": clientId,
        }),
    );
    const tanda = createHmac("sha256", secret).update(`${kepala}.${isi}`).digest("base64url");
    return `${kepala}.${isi}.${tanda}`;
}

/** Token langganan untuk pengguna ini, atau null bila realtime mati. */
export function tokenLangganan(userId: number, saluran: string[]): string | null {
    const k = konfigurasi();
    return k ? buatJwt(k.keyName, k.secret, `pengguna-${userId}`, saluran) : null;
}

async function kirim(k: Konfigurasi, p: Peristiwa, s: Sasaran): Promise<void> {
    const pesan = pesanUntukSasaran(p, s);
    if (!pesan.length) return;
    const body = JSON.stringify(
        pesan.map((m) => ({ channels: [m.saluran], messages: { name: NAMA_EVENT, data: JSON.stringify(m.data) } })),
    );
    const res = await fetch(`${k.rest}/messages`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Basic ${Buffer.from(`${k.keyName}:${k.secret}`).toString("base64")}`,
      // Aplikasi Ably mewajibkan klien beridentitas; dengan kunci API peladen boleh menyebut dirinya.
      "x-ably-clientid": Buffer.from("peladen").toString("base64"),
        },
        body,
        signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`realtime ${res.status}`);
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
