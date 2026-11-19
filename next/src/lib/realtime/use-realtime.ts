"use client";

import { useEffect, useRef } from "react";
import { SambunganRealtime, type StatusRealtime } from "./klien";
import type { KonfigurasiKlienRealtime, Peristiwa } from "./saluran";

/** Tab tersembunyi selama ini: sambungan ditutup (hemat kuota sambungan), dibuka lagi saat terlihat. */
const TUTUP_SETELAH_SEMBUNYI_MS = 30_000;

/** Dari peladen: null = realtime mati (bendera fitur), perilaku cadangan saja. */
export type KonfigurasiRealtime = (KonfigurasiKlienRealtime & { saluran: string[] }) | null;

/**
 * Sambungan realtime selama komponen terpasang. `onPulih` dipanggil saat tersambung lagi setelah
 * putus atau setelah tab disembunyikan lama: peristiwa di antaranya mungkin terlewat.
 * Status tercermin di <html data-realtime> (dipakai E2E dan untuk diagnosis).
 */
export function useRealtime(
    konfigurasi: KonfigurasiRealtime,
    onPeristiwa: (p: Peristiwa) => void,
    onPulih: () => void,
): React.RefObject<StatusRealtime> {
    const status = useRef<StatusRealtime>(konfigurasi ? "terputus" : "mati");
    const peristiwaRef = useRef(onPeristiwa);
    const pulihRef = useRef(onPulih);
    useEffect(() => {
        peristiwaRef.current = onPeristiwa;
        pulihRef.current = onPulih;
    });
    const kunci = konfigurasi ? JSON.stringify(konfigurasi) : "";

    useEffect(() => {
        const html = document.documentElement;
        if (!kunci) {
            status.current = "mati";
            html.dataset.realtime = "mati";
            return;
        }
        const { saluran, ...k } = JSON.parse(kunci) as NonNullable<KonfigurasiRealtime>;
        const sambungan = new SambunganRealtime({
            konfigurasi: k,
            saluran,
            onPeristiwa: (p) => peristiwaRef.current(p),
            onStatus: (s, pulih) => {
                status.current = s;
                html.dataset.realtime = s;
                if (s === "tersambung" && pulih) pulihRef.current();
            },
        });
        let pewaktuTutup: ReturnType<typeof setTimeout> | undefined;
        const saatTerlihat = () => {
            clearTimeout(pewaktuTutup);
            if (document.visibilityState === "hidden") {
                pewaktuTutup = setTimeout(() => sambungan.hentikan(), TUTUP_SETELAH_SEMBUNYI_MS);
            } else if (navigator.onLine) {
                sambungan.lanjutkan();
            }
        };
        const daring = () => sambungan.lanjutkan();
        const luring = () => sambungan.hentikan();
        // Setelah halaman tampil: SDK dimuat terpisah dan tidak bersaing dengan isi halaman.
        const mulai = setTimeout(() => navigator.onLine && sambungan.mulai(), 300);
        document.addEventListener("visibilitychange", saatTerlihat);
        window.addEventListener("online", daring);
        window.addEventListener("offline", luring);
        return () => {
            clearTimeout(mulai);
            clearTimeout(pewaktuTutup);
            document.removeEventListener("visibilitychange", saatTerlihat);
            window.removeEventListener("online", daring);
            window.removeEventListener("offline", luring);
            sambungan.tutup();
            delete html.dataset.realtime;
        };
    }, [kunci]);

    return status;
}
