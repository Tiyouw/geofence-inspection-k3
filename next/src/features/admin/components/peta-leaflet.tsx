"use client";

/**
 * Peta Leaflet + ubin dasar (lib/geo/ubin.ts, bawaan tanpa label). Dimuat hanya di klien (lihat peta.tsx).
 * Titik digambar sebagai circleMarker (tanpa gambar ikon), warna diambil dari token CSS
 * sehingga mengikuti arah desain yang dipilih.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { batasPeta } from "../lib/dasbor";
import { UBIN_PETA } from "@/lib/geo/ubin";

export type TitikTampil = {
    id: number;
    lat: number;
    lng: number;
    judul: string;
    rincian?: string;
    /** Nama token warna: success | warning | danger | info | muted-foreground | brand */
    warna: string;
    cincin?: boolean;
    href?: string;
};

/** Poligon GeoJSON (WGS84) yang digambar di bawah titik, mis. gedung aset dan kawasan galangan. */
export type PoligonTampil = {
    geojson: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
    judul: string;
    warna: string;
    /** Garis putus-putus, mis. untuk kawasan. */
    putus?: boolean;
};

/** Lingkaran berjari-jari meter, mis. akurasi GPS di sekitar posisi inspektur. */
export type LingkaranTampil = { lat: number; lng: number; radius: number; warna: string; judul?: string };

const PUSAT_BAWAAN: [number, number] = [-7.2054, 112.7378];

function warnaToken(nama: string): string {
    if (typeof window === "undefined") return "#888";
    return getComputedStyle(document.documentElement).getPropertyValue(`--${nama}`).trim() || "#888";
}

function lapisanOsm() {
    return L.tileLayer(UBIN_PETA.url, {
        maxZoom: 19,
        maxNativeZoom: UBIN_PETA.zoomMaksAsli,
        ...(UBIN_PETA.subdomain ? { subdomains: UBIN_PETA.subdomain } : {}),
        attribution: UBIN_PETA.atribusi,
    });
}

/**
 * Buka peta pas di bingkai. Dengan kawasan: padding kecil, zoom minimum satu tingkat di bawah
 * bingkai, dan geseran dibatasi (bingkai + 50%) supaya tidak bisa mundur ke tampilan kota.
 */
function bingkaiKe(m: L.Map, b: [[number, number], [number, number]], kunci: boolean) {
    const batas = L.latLngBounds(b);
    if (!kunci) {
        m.fitBounds(batas, { padding: [32, 32], maxZoom: 18 });
        return;
    }
    m.setMinZoom(0);
    m.setMaxBounds();
    m.fitBounds(batas, { padding: [12, 12], maxZoom: 18, animate: false });
    const z = m.getBoundsZoom(batas, false, L.point(24, 24));
    m.setMinZoom(Math.max(0, Math.min(z, 18) - 1));
    m.setMaxBounds(batas.pad(0.5));
    const w = m.getContainer();
    w.dataset.zoomMin = String(m.getMinZoom());
}

function esc(s: string) {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function PetaLeaflet({
    titik,
    tinggi = 360,
    pilih,
    onPilih,
    poligon,
    lingkaran,
    batas,
    kawasan,
    label = "Peta lokasi aset",
}: {
    titik: TitikTampil[];
    tinggi?: number;
    /** Mode pemilih: titik terpilih saat ini (atau null). */
    pilih?: { lat: number; lng: number } | null;
    onPilih?: (p: { lat: number; lng: number }) => void;
    poligon?: PoligonTampil[];
    lingkaran?: LingkaranTampil[];
    /** Bingkai tampilan yang ditentukan pemanggil (mis. peta tinjauan); menggantikan bingkai otomatis. */
    batas?: [[number, number], [number, number]] | null;
    /**
     * Kotak batas kawasan galangan yang disetujui. Bila ada, peta dibuka pas di kawasan
     * (digabung dengan `batas` bila diberikan), zoom minimum dikunci satu tingkat di bawahnya,
     * dan geseran dibatasi di sekitar kawasan supaya tidak jatuh ke tampilan kota.
     */
    kawasan?: [[number, number], [number, number]] | null;
    label?: string;
}) {
    const wadah = useRef<HTMLDivElement>(null);
    const peta = useRef<L.Map | null>(null);
    const lapisTitik = useRef<L.LayerGroup | null>(null);
    const lapisPilih = useRef<L.LayerGroup | null>(null);
    const lapisBentuk = useRef<L.LayerGroup | null>(null);
    const onPilihRef = useRef(onPilih);
    // Nilai stabil (string) supaya array batas baru tiap render tidak memicu fitBounds berulang.
    const kunciBatas = batas ? JSON.stringify(batas) : "";
    const kunciKawasan = kawasan ? JSON.stringify(kawasan) : "";
    const bingkai = useMemo(() => {
        const b = kunciBatas ? (JSON.parse(kunciBatas) as [[number, number], [number, number]]) : null;
        const k = kunciKawasan ? (JSON.parse(kunciKawasan) as [[number, number], [number, number]]) : null;
        if (!k) return b;
        if (!b) return k;
        return [
            [Math.min(b[0][0], k[0][0]), Math.min(b[0][1], k[0][1])],
            [Math.max(b[1][0], k[1][0]), Math.max(b[1][1], k[1][1])],
        ] as [[number, number], [number, number]];
    }, [kunciBatas, kunciKawasan]);
    const adaKawasan = !!kunciKawasan;
    useEffect(() => {
        onPilihRef.current = onPilih;
    }, [onPilih]);

    useEffect(() => {
        if (!wadah.current || peta.current) return;
        // Kanvas: ratusan titik/lingkaran sebagai satu <canvas>, bukan satu <path> SVG per titik (ponsel lambat).
        const m = L.map(wadah.current, { scrollWheelZoom: false, preferCanvas: true }).setView(PUSAT_BAWAAN, 16);
        lapisanOsm().addTo(m);
        lapisBentuk.current = L.layerGroup().addTo(m);
        lapisTitik.current = L.layerGroup().addTo(m);
        lapisPilih.current = L.layerGroup().addTo(m);
        m.on("click", (e: L.LeafletMouseEvent) => {
            onPilihRef.current?.({ lat: Number(e.latlng.lat.toFixed(7)), lng: Number(e.latlng.lng.toFixed(7)) });
        });
        // Pegangan uji E2E: proyeksi titik → piksel dan zoom dibaca dari elemen wadah.
        (wadah.current as HTMLDivElement & { petaLeaflet?: L.Map }).petaLeaflet = m;
        peta.current = m;
        return () => {
            m.remove();
            peta.current = null;
        };
    }, []);

    useEffect(() => {
        const m = peta.current;
        const g = lapisBentuk.current;
        if (!m || !g) return;
        g.clearLayers();
        const batas = L.latLngBounds([]);
        for (const p of poligon ?? []) {
            const warna = warnaToken(p.warna);
            const lapis = L.geoJSON(p.geojson as GeoJSON.GeoJsonObject, {
                style: { color: warna, weight: 2, fillOpacity: 0.08, dashArray: p.putus ? "6 6" : undefined },
            })
                .bindTooltip(esc(p.judul))
                .addTo(g);
            batas.extend(lapis.getBounds());
        }
        for (const c of lingkaran ?? []) {
            const warna = warnaToken(c.warna);
            const lapis = L.circle([c.lat, c.lng], { radius: c.radius, color: warna, weight: 1.5, fillOpacity: 0.12 }).addTo(g);
            if (c.judul) lapis.bindTooltip(esc(c.judul));
            batas.extend(lapis.getBounds());
        }
        for (const t of titik) batas.extend([t.lat, t.lng]);
        if (bingkai) bingkaiKe(m, bingkai, adaKawasan);
        else if (batas.isValid() && (poligon?.length || lingkaran?.length)) m.fitBounds(batas, { padding: [24, 24], maxZoom: 18 });
    }, [poligon, lingkaran, titik, bingkai, adaKawasan]);

    useEffect(() => {
        const m = peta.current;
        const g = lapisTitik.current;
        if (!m || !g) return;
        g.clearLayers();
        for (const t of titik) {
            const warna = warnaToken(t.warna);
            const c = L.circleMarker([t.lat, t.lng], {
                radius: 7,
                color: t.cincin ? warnaToken("danger") : "#fff",
                weight: t.cincin ? 3 : 1.5,
                fillColor: warna,
                fillOpacity: 0.95,
            }).addTo(g);
            const isi = `<strong>${esc(t.judul)}</strong>${t.rincian ? `<br>${esc(t.rincian)}` : ""}${
                t.href ? `<br><a href="${esc(t.href)}">Buka</a>` : ""
            }`;
            c.bindPopup(isi);
            c.bindTooltip(esc(t.judul));
        }
        if (!pilih && !bingkai && !poligon?.length && !lingkaran?.length) {
            const b = batasPeta(titik);
            if (b) m.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
        }
    }, [titik, pilih, poligon, lingkaran, bingkai]);

    useEffect(() => {
        const m = peta.current;
        const g = lapisPilih.current;
        if (!m || !g) return;
        g.clearLayers();
        if (!pilih) return;
        L.circleMarker([pilih.lat, pilih.lng], {
            radius: 8,
            color: "#fff",
            weight: 2,
            fillColor: warnaToken("brand"),
            fillOpacity: 1,
        }).addTo(g);
        if (!m.getBounds().contains([pilih.lat, pilih.lng]))
            m.setView([pilih.lat, pilih.lng], Math.max(m.getZoom(), 17));
    }, [pilih]);

    return (
        <div
            ref={wadah}
            role="application"
            aria-label={label}
            data-testid="peta-leaflet"
            data-bingkai-kawasan={adaKawasan ? "ya" : "tidak"}
            style={{ height: tinggi }}
            className="relative z-0 w-full overflow-hidden rounded-lg border bg-muted"
        />
    );
}
