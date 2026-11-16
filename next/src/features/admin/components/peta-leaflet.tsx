"use client";

/**
 * Peta Leaflet + ubin OpenStreetMap. Dimuat hanya di klien (lihat peta.tsx).
 * Titik digambar sebagai circleMarker (tanpa gambar ikon), warna diambil dari token CSS
 * sehingga mengikuti arah desain yang dipilih.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { batasPeta } from "../lib/dasbor";

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

const PUSAT_BAWAAN: [number, number] = [-7.2054, 112.7378];

function warnaToken(nama: string): string {
    if (typeof window === "undefined") return "#888";
    return getComputedStyle(document.documentElement).getPropertyValue(`--${nama}`).trim() || "#888";
}

function lapisanOsm() {
    return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
}

function esc(s: string) {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function PetaLeaflet({
    titik,
    tinggi = 360,
    pilih,
    onPilih,
    radius,
    label = "Peta lokasi aset",
}: {
    titik: TitikTampil[];
    tinggi?: number;
    /** Mode pemilih: titik terpilih saat ini (atau null). */
    pilih?: { lat: number; lng: number } | null;
    onPilih?: (p: { lat: number; lng: number }) => void;
    /** Lingkaran radius gerbang di sekitar titik terpilih (meter). */
    radius?: number | null;
    label?: string;
}) {
    const wadah = useRef<HTMLDivElement>(null);
    const peta = useRef<L.Map | null>(null);
    const lapisTitik = useRef<L.LayerGroup | null>(null);
    const lapisPilih = useRef<L.LayerGroup | null>(null);
    const onPilihRef = useRef(onPilih);
    useEffect(() => {
        onPilihRef.current = onPilih;
    }, [onPilih]);

    useEffect(() => {
        if (!wadah.current || peta.current) return;
        const m = L.map(wadah.current, { scrollWheelZoom: false }).setView(PUSAT_BAWAAN, 16);
        lapisanOsm().addTo(m);
        lapisTitik.current = L.layerGroup().addTo(m);
        lapisPilih.current = L.layerGroup().addTo(m);
        m.on("click", (e: L.LeafletMouseEvent) => {
            onPilihRef.current?.({ lat: Number(e.latlng.lat.toFixed(7)), lng: Number(e.latlng.lng.toFixed(7)) });
        });
        peta.current = m;
        return () => {
            m.remove();
            peta.current = null;
        };
    }, []);

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
        if (!pilih) {
            const b = batasPeta(titik);
            if (b) m.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
        }
    }, [titik, pilih]);

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
        if (radius) {
            L.circle([pilih.lat, pilih.lng], {
                radius,
                color: warnaToken("brand"),
                weight: 1.5,
                fillOpacity: 0.08,
            }).addTo(g);
        }
        if (!m.getBounds().contains([pilih.lat, pilih.lng]))
            m.setView([pilih.lat, pilih.lng], Math.max(m.getZoom(), 17));
    }, [pilih, radius]);

    return (
        <div
            ref={wadah}
            role="application"
            aria-label={label}
            style={{ height: tinggi }}
            className="relative z-0 w-full overflow-hidden rounded-lg border bg-muted"
        />
    );
}
