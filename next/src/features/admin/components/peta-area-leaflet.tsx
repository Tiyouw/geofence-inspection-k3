"use client";

/**
 * Peta editor area: Leaflet + ubin OpenStreetMap. Menggambar poligon area (resmi dan draf),
 * titik aset, pratinjau impor, dan pegangan simpul untuk menyunting satu poligon.
 * Dimuat hanya di klien (lihat peta-area.tsx). Warna dari token CSS.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { GeometriArea, LngLat } from "@/lib/geo/geometri";

export type PoligonTampil = {
    id: number | string;
    nama: string;
    geometry: GeometriArea;
    gaya: "kawasan" | "area" | "terbatas" | "impor" | "impor-galat";
    draf?: boolean;
};

export type TitikAset = { id: number; lat: number; lng: number; kode: string; terpasang: boolean };

const PUSAT_BAWAAN: [number, number] = [-7.2054, 112.7378];

function token(nama: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${nama}`).trim() || "#888";
}

function esc(s: string) {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const keLatLng = (g: GeometriArea): L.LatLngExpression[][][] =>
    (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((p) => p.map((c) => c.map(([lng, lat]) => [lat, lng] as [number, number])));

function gayaPoligon(p: PoligonTampil, terpilih: boolean): L.PathOptions {
    const warna =
        p.gaya === "kawasan"
            ? token("muted-foreground")
            : p.gaya === "terbatas"
              ? token("danger")
              : p.gaya === "impor"
                ? token("chart-2")
                : p.gaya === "impor-galat"
                  ? token("danger")
                  : token("info");
    return {
        color: terpilih ? token("peran-admin") : warna,
        weight: terpilih ? 3 : p.gaya === "kawasan" ? 2 : 1.5,
        dashArray: p.draf || p.gaya === "kawasan" ? "6 5" : undefined,
        fillColor: warna,
        fillOpacity: p.gaya === "kawasan" ? 0.03 : terpilih ? 0.25 : 0.12,
        className: `poligon-${p.gaya}`,
    };
}

export default function PetaAreaLeaflet({
    poligon,
    aset,
    pilihId,
    onPilih,
    sunting,
    onSunting,
    gambar,
    onKlikPeta,
    fokus,
    tinggi = 620,
}: {
    poligon: PoligonTampil[];
    aset: TitikAset[];
    pilihId: number | string | null;
    onPilih?: (id: number | string) => void;
    /** Cincin luar yang sedang disunting (tanpa titik penutup). */
    sunting?: LngLat[] | null;
    onSunting?: (c: LngLat[]) => void;
    /** Titik poligon baru yang sedang digambar. */
    gambar?: LngLat[] | null;
    onKlikPeta?: (p: LngLat) => void;
    /** Ubah nilai ini untuk memusatkan peta ke semua poligon. */
    fokus?: number;
    tinggi?: number;
}) {
    const wadah = useRef<HTMLDivElement>(null);
    const peta = useRef<L.Map | null>(null);
    const lapis = useRef<{ poligon: L.LayerGroup; aset: L.LayerGroup; sunting: L.LayerGroup } | null>(null);
    const cb = useRef({ onPilih, onSunting, onKlikPeta });
    useEffect(() => {
        cb.current = { onPilih, onSunting, onKlikPeta };
    }, [onPilih, onSunting, onKlikPeta]);

    useEffect(() => {
        if (!wadah.current || peta.current) return;
        const m = L.map(wadah.current, { scrollWheelZoom: true, doubleClickZoom: false }).setView(PUSAT_BAWAAN, 16);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 20,
            maxNativeZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(m);
        lapis.current = {
            poligon: L.layerGroup().addTo(m),
            aset: L.layerGroup().addTo(m),
            sunting: L.layerGroup().addTo(m),
        };
        m.on("click", (e: L.LeafletMouseEvent) => {
            cb.current.onKlikPeta?.([Number(e.latlng.lng.toFixed(7)), Number(e.latlng.lat.toFixed(7))]);
        });
        peta.current = m;
        return () => {
            m.remove();
            peta.current = null;
        };
    }, []);

    // Poligon
    useEffect(() => {
        const g = lapis.current?.poligon;
        if (!g) return;
        g.clearLayers();
        const urut = [...poligon].sort((a, b) => Number(b.gaya === "kawasan") - Number(a.gaya === "kawasan"));
        for (const p of urut) {
            const terpilih = p.id === pilihId;
            if (terpilih && sunting) continue; // digambar oleh lapis sunting
            const lyr = L.polygon(keLatLng(p.geometry), { ...gayaPoligon(p, terpilih), bubblingMouseEvents: false }).addTo(g);
            lyr.bindTooltip(esc(p.nama), { sticky: true });
            lyr.on("click", () => cb.current.onPilih?.(p.id));
            if (terpilih) lyr.bringToFront();
        }
    }, [poligon, pilihId, sunting]);

    // Titik aset
    useEffect(() => {
        const g = lapis.current?.aset;
        if (!g) return;
        g.clearLayers();
        for (const a of aset) {
            L.circleMarker([a.lat, a.lng], {
                radius: 4,
                color: "#fff",
                weight: 1,
                fillColor: a.terpasang ? token("chart-3") : token("muted-foreground"),
                fillOpacity: 0.95,
                interactive: true,
                bubblingMouseEvents: false,
            })
                .bindTooltip(esc(a.kode))
                .addTo(g);
        }
    }, [aset]);

    // Pegangan simpul
    useEffect(() => {
        const g = lapis.current?.sunting;
        if (!g) return;
        g.clearLayers();
        const warna = token("peran-admin");
        if (gambar && gambar.length) {
            L.polyline(
                gambar.map(([lng, lat]) => [lat, lng] as [number, number]),
                { color: warna, weight: 2, dashArray: "4 4" },
            ).addTo(g);
            for (const [lng, lat] of gambar) {
                L.circleMarker([lat, lng], { radius: 5, color: "#fff", weight: 2, fillColor: warna, fillOpacity: 1 }).addTo(g);
            }
        }
        if (!sunting || sunting.length < 3) return;
        const titik = sunting.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(titik, { color: warna, weight: 2.5, fillColor: warna, fillOpacity: 0.15, interactive: false }).addTo(g);
        const simpul = L.divIcon({ className: "simpul-poligon", iconSize: [14, 14] });
        const tengah = L.divIcon({ className: "simpul-poligon simpul-tengah", iconSize: [10, 10] });
        sunting.forEach(([lng, lat], i) => {
            const mk = L.marker([lat, lng], { icon: simpul, draggable: true, keyboard: true, title: `Simpul ${i + 1}` }).addTo(g);
            mk.on("dragend", () => {
                const ll = mk.getLatLng();
                const baru = [...sunting];
                baru[i] = [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
                cb.current.onSunting?.(baru);
            });
            const hapus = () => {
                if (sunting.length <= 3) return;
                cb.current.onSunting?.(sunting.filter((_, j) => j !== i));
            };
            mk.on("contextmenu", hapus);
            mk.on("dblclick", hapus);
            // Titik tengah: klik untuk menambah simpul di antara dua simpul.
            const [nlng, nlat] = sunting[(i + 1) % sunting.length];
            const mid: LngLat = [Number(((lng + nlng) / 2).toFixed(7)), Number(((lat + nlat) / 2).toFixed(7))];
            L.marker([mid[1], mid[0]], { icon: tengah, title: "Tambah simpul" })
                .addTo(g)
                .on("click", () => {
                    const baru = [...sunting];
                    baru.splice(i + 1, 0, mid);
                    cb.current.onSunting?.(baru);
                });
        });
    }, [sunting, gambar]);

    // Fokus ke semua poligon (saat dimuat, setelah impor, atau ketika diminta)
    const fokusTerakhir = useRef<number | undefined>(-1);
    useEffect(() => {
        const m = peta.current;
        if (!m || fokusTerakhir.current === fokus || !poligon.length) return;
        fokusTerakhir.current = fokus;
        const b = L.latLngBounds([]);
        for (const p of poligon) b.extend(L.polygon(keLatLng(p.geometry)).getBounds());
        if (b.isValid()) m.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
    }, [fokus, poligon]);

    // Fokus ke poligon terpilih
    useEffect(() => {
        const m = peta.current;
        const p = poligon.find((x) => x.id === pilihId);
        if (!m || !p) return;
        const b = L.polygon(keLatLng(p.geometry)).getBounds();
        if (!m.getBounds().contains(b)) m.flyToBounds(b, { padding: [40, 40], maxZoom: 19, duration: 0.6 });
        // hanya saat pilihan berubah
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pilihId]);

    return (
        <div
            ref={wadah}
            role="application"
            aria-label="Peta area dan poligon"
            data-testid="peta-area"
            style={{ height: tinggi }}
            className="relative z-0 w-full overflow-hidden rounded-lg border bg-muted [&_.simpul-poligon]:rounded-full [&_.simpul-poligon]:border-2 [&_.simpul-poligon]:border-white [&_.simpul-poligon]:bg-peran-admin [&_.simpul-poligon]:shadow [&_.simpul-tengah]:opacity-60"
        />
    );
}
