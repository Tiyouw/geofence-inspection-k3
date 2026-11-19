/**
 * Sambungan realtime di peramban lewat SDK Ably (modular: hanya WebSocket + fetch, dimuat
 * dinamis setelah halaman tampil). Token dari /api/realtime/token (JWT, kapabilitas subscribe
 * saluran milik pengguna). Sambung ulang dengan jeda diurus SDK: 3 s saat terputus, 15 s setelah
 * lama putus (suspended).
 */
import type { BaseRealtime } from "ably/modular";
import { NAMA_EVENT, bacaPeristiwa, type KonfigurasiKlienRealtime, type Peristiwa } from "./saluran";

export type StatusRealtime = "menyambung" | "tersambung" | "terputus" | "mati";

export type OpsiRealtime = {
    konfigurasi: KonfigurasiKlienRealtime;
    saluran: string[];
    tokenUrl?: string;
    onPeristiwa: (p: Peristiwa, saluran: string) => void;
    /** `pulih` = tersambung lagi setelah sempat putus: peristiwa selama putus mungkin terlewat. */
    onStatus?: (s: StatusRealtime, pulih: boolean) => void;
};

export class SambunganRealtime {
    private klien: BaseRealtime | null = null;
    private memuat: Promise<void> | null = null;
    private pernahTersambung = false;
    private berhenti = false;
    status: StatusRealtime = "terputus";

    constructor(private readonly o: OpsiRealtime) {}

    private setStatus(s: StatusRealtime, pulih = false) {
        if (s === this.status && !pulih) return;
        this.status = s;
        this.o.onStatus?.(s, pulih);
    }

    private async buat() {
        const { BaseRealtime, WebSocketTransport, FetchRequest } = await import("ably/modular");
        if (this.berhenti) return;
        const klien = new BaseRealtime({
            ...this.o.konfigurasi,
            authUrl: this.o.tokenUrl ?? "/api/realtime/token",
            authMethod: "GET",
            plugins: { WebSocketTransport, FetchRequest },
            useBinaryProtocol: false,
            echoMessages: false,
            closeOnUnload: true,
            disconnectedRetryTimeout: 3000,
            suspendedRetryTimeout: 15000,
            logLevel: 1,
        });
        this.klien = klien;
        klien.connection.on((c) => {
            if (c.current === "connected") {
                const pulih = this.pernahTersambung;
                this.pernahTersambung = true;
                this.setStatus("tersambung", pulih);
            } else if (c.current === "connecting") this.setStatus("menyambung");
            else if (c.current === "failed") this.setStatus("mati");
            else if (c.current === "disconnected" || c.current === "suspended" || c.current === "closed")
                this.setStatus("terputus");
        });
        for (const nama of this.o.saluran) {
            void klien.channels
                .get(nama)
                .subscribe(NAMA_EVENT, (m) => {
                    const p = bacaPeristiwa(m.data);
                    if (p) this.o.onPeristiwa(p, nama);
                })
                .catch(() => {});
        }
    }

    mulai() {
        this.berhenti = false;
        if (this.klien) {
            this.klien.connection.connect();
            return;
        }
        this.setStatus("menyambung");
        this.memuat ??= this.buat().catch(() => this.setStatus("mati"));
    }

    /** Tutup sambungan (tab tersembunyi lama, luring). Bisa dilanjutkan dengan lanjutkan(). */
    hentikan() {
        this.berhenti = true;
        this.klien?.connection.close();
        if (this.status !== "mati") this.setStatus("terputus");
    }

    /** Buka lagi setelah hentikan(), mis. tab terlihat kembali atau daring lagi. */
    lanjutkan() {
        if (this.status === "mati") return;
        this.mulai();
    }

    /** Lepas seluruh sumber daya (komponen dilepas). */
    tutup() {
        this.hentikan();
        this.klien = null;
    }
}
