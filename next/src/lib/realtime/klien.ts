/**
 * Klien realtime minimal untuk protokol WebSocket Pusher Channels (versi 7), tanpa pustaka:
 * sambung, langganan saluran privat lewat /api/realtime/auth, ping/pong, dan sambung ulang
 * dengan jeda bertambah (1 s, 2 s, 4 s, ... maks 30 s, plus acak).
 */
import { NAMA_EVENT, bacaPeristiwa, type Peristiwa } from "./saluran";

export type StatusRealtime = "menyambung" | "tersambung" | "terputus" | "mati";

export type OpsiRealtime = {
    key: string;
    ws: string;
    saluran: string[];
    authUrl?: string;
    onPeristiwa: (p: Peristiwa, saluran: string) => void;
    /** `pulih` = tersambung lagi setelah sempat putus: peristiwa selama putus mungkin terlewat. */
    onStatus?: (s: StatusRealtime, pulih: boolean) => void;
};

const JEDA_MAKS_MS = 30_000;
const TUNGGU_PONG_MS = 30_000;

export class SambunganRealtime {
    private ws: WebSocket | null = null;
    private percobaan = 0;
    private berhenti = false;
    private pernahTersambung = false;
    private pewaktuUlang: ReturnType<typeof setTimeout> | undefined;
    private pewaktuDiam: ReturnType<typeof setTimeout> | undefined;
    private pewaktuPong: ReturnType<typeof setTimeout> | undefined;
    private batasDiamMs = 120_000;
    private berlangganan = new Set<string>();
    status: StatusRealtime = "terputus";

    constructor(private readonly o: OpsiRealtime) {}

    private setStatus(s: StatusRealtime, pulih = false) {
        this.status = s;
        this.o.onStatus?.(s, pulih);
    }

    mulai() {
        this.berhenti = false;
        if (this.ws) return;
        clearTimeout(this.pewaktuUlang);
        this.setStatus("menyambung");
        let ws: WebSocket;
        try {
            ws = new WebSocket(
                `${this.o.ws}/app/${encodeURIComponent(this.o.key)}?protocol=7&client=pal-k3&version=1.0&flash=false`,
            );
        } catch {
            this.jadwalkanUlang();
            return;
        }
        this.ws = ws;
        this.berlangganan.clear();
        ws.onmessage = (e) => this.terima(ws, typeof e.data === "string" ? e.data : "");
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.ws = null;
            this.bersihkanPewaktu();
            if (this.berhenti) return;
            this.setStatus("terputus");
            this.jadwalkanUlang();
        };
        ws.onerror = () => ws.close();
    }

    /** Tutup dan jangan sambung ulang (tab tersembunyi lama, keluar, luring). */
    hentikan(status: StatusRealtime = "terputus") {
        this.berhenti = true;
        clearTimeout(this.pewaktuUlang);
        this.bersihkanPewaktu();
        const ws = this.ws;
        this.ws = null;
        ws?.close();
        this.setStatus(status);
    }

    /** Sambung lagi sekarang tanpa menunggu jeda (mis. kembali daring). */
    segera() {
        if (this.ws || this.status === "mati") return;
        this.percobaan = 0;
        this.mulai();
    }

    private jadwalkanUlang(cepat = false) {
        if (this.berhenti) return;
        clearTimeout(this.pewaktuUlang);
        const dasar = cepat ? 0 : Math.min(JEDA_MAKS_MS, 1000 * 2 ** this.percobaan);
        this.percobaan++;
        this.pewaktuUlang = setTimeout(() => this.mulai(), dasar + Math.random() * 500);
    }

    private bersihkanPewaktu() {
        clearTimeout(this.pewaktuDiam);
        clearTimeout(this.pewaktuPong);
    }

    private kirim(ws: WebSocket, event: string, data: unknown) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data }));
    }

    /** Tanpa pesan selama batasDiamMs: kirim ping, tunggu pong, kalau tidak datang sambung ulang. */
    private aktif(ws: WebSocket) {
        this.bersihkanPewaktu();
        this.pewaktuDiam = setTimeout(() => {
            this.kirim(ws, "pusher:ping", {});
            this.pewaktuPong = setTimeout(() => ws.close(), TUNGGU_PONG_MS);
        }, this.batasDiamMs);
    }

    private async langganan(ws: WebSocket, socketId: string, saluran: string): Promise<boolean> {
        let res: Response;
        try {
            res = await fetch(this.o.authUrl ?? "/api/realtime/auth", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ socket_id: socketId, channel_name: saluran }),
                credentials: "same-origin",
            });
        } catch {
            ws.close();
            return false;
        }
        if (res.status === 401 || res.status === 403 || res.status === 404) {
            // Sesi habis, saluran bukan haknya, atau realtime dimatikan: jangan mencoba terus.
            this.hentikan("mati");
            return false;
        }
        if (!res.ok) {
            ws.close();
            return false;
        }
        const { auth } = (await res.json()) as { auth: string };
        this.kirim(ws, "pusher:subscribe", { channel: saluran, auth });
        return true;
    }

    private terima(ws: WebSocket, mentah: string) {
        let m: { event?: string; channel?: string; data?: unknown };
        try {
            m = JSON.parse(mentah);
        } catch {
            return;
        }
        this.aktif(ws);
        const data = typeof m.data === "string" ? safeJson(m.data) : m.data;
        switch (m.event) {
            case "pusher:connection_established": {
                const d = data as { socket_id?: string; activity_timeout?: number };
                if (d?.activity_timeout) this.batasDiamMs = Math.min(120, d.activity_timeout) * 1000;
                this.aktif(ws);
                for (const s of this.o.saluran) void this.langganan(ws, d?.socket_id ?? "", s);
                return;
            }
            case "pusher_internal:subscription_succeeded":
                if (m.channel) this.berlangganan.add(m.channel);
                if (this.berlangganan.size === this.o.saluran.length && this.status !== "tersambung") {
                    this.percobaan = 0;
                    const pulih = this.pernahTersambung;
                    this.pernahTersambung = true;
                    this.setStatus("tersambung", pulih);
                }
                return;
            case "pusher:ping":
                this.kirim(ws, "pusher:pong", {});
                return;
            case "pusher:pong":
                return;
            case "pusher:error": {
                const code = Number((data as { code?: number } | null)?.code ?? 0);
                // 4000-4099: jangan sambung ulang (kunci/aplikasi salah); 4200-4299: segera; lainnya: dengan jeda.
                if (code >= 4000 && code < 4100) this.hentikan("mati");
                else if (code >= 4200 && code < 4300) {
                    this.ws = null;
                    ws.close();
                    this.jadwalkanUlang(true);
                }
                return;
            }
            case NAMA_EVENT: {
                const p = bacaPeristiwa(data);
                if (p && m.channel) this.o.onPeristiwa(p, m.channel);
                return;
            }
        }
    }

    /** Setelah hentikan(): boleh mulai lagi, mis. tab terlihat kembali. Peristiwa selama tertutup terlewat. */
    lanjutkan() {
        if (this.status === "mati") return;
        this.percobaan = 0;
        this.mulai();
    }
}

function safeJson(s: string): unknown {
    try {
        return JSON.parse(s);
    } catch {
        return s;
    }
}
