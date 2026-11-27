"use client";

/**
 * Peta editor area: Leaflet + ubin dasar (lib/geo/ubin.ts, bawaan tanpa label). Menggambar poligon area (resmi dan draf),
 * titik aset, pratinjau impor, dan pegangan simpul untuk menyunting satu poligon.
 * Dimuat hanya di klien (lihat peta-area.tsx). Warna dari token CSS.
 *
 * Poligon area dan titik aset digambar di satu kanvas: ratusan <path> SVG membuat halaman Lokasi
 * tertahan ~1 detik di ponsel lambat. Kanvas yang sama menjaga urutan (titik di atas poligon) dan
 * klik/hover tiap bentuk. Sorotan terpilih (2 garis + pin) tetap SVG/DOM di pane "sorot".
 * Keadaan peta untuk uji dan alat bantu ada di atribut data wadah: data-poligon, data-poligon-impor,
 * data-terpilih, data-redup.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { UBIN_PETA } from "@/lib/geo/ubin";
import { useEffect, useRef } from "react";
import { areaTerkecilDi, type GeometriArea, type LngLat, luasM2, titikLabel } from "@/lib/geo/geometri";

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

type Keadaan = "biasa" | "redup" | "terpilih" | "hover";

function warnaPoligon(p: PoligonTampil) {
    return p.gaya === "kawasan"
        ? token("muted-foreground")
        : p.gaya === "terbatas" || p.gaya === "impor-galat"
          ? token("danger")
          : p.gaya === "impor"
            ? token("chart-2")
            : token("info");
}

/**
 * Gaya dasar poligon. Yang terpilih digambar ulang di pane "sorot" di atas semuanya (garis
 * putih lebar + garis aksen tebal), jadi aslinya dibuat transparan tetapi tetap bisa diklik.
 */
function gayaPoligon(p: PoligonTampil, k: Keadaan): L.PathOptions {
    const warna = warnaPoligon(p);
    const tebal = p.gaya === "kawasan" ? 2 : 1.5;
    const isi = p.gaya === "kawasan" ? 0.03 : 0.12;
    return {
        color: warna,
        weight: k === "hover" ? tebal + 2 : tebal,
        opacity: k === "terpilih" ? 0 : k === "redup" ? 0.35 : 1,
        dashArray: p.draf || p.gaya === "kawasan" ? "6 5" : undefined,
        fillColor: warna,
        fillOpacity: k === "terpilih" ? 0 : k === "redup" ? isi * 0.35 : k === "hover" ? isi + 0.08 : isi,
    };
}

const IKON_PIN =
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#fff"/>';
const IKON_KAWASAN =
    '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>';

function ikonPin(p: PoligonTampil): L.DivIcon {
    const kawasan = p.gaya === "kawasan";
    const svg = `<svg class="pin-ikon" viewBox="0 0 24 24" fill="var(--sorot-peta)" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kawasan ? IKON_KAWASAN : IKON_PIN}</svg>`;
    return L.divIcon({
        className: `pin-terpilih${kawasan ? " pin-kawasan" : ""}`,
        html: `${svg}<span class="pin-label">${esc(p.nama)}</span>`,
        iconSize: [0, 0],
    });
}

const gerakDikurangi = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PetaAreaLeaflet({
    poligon,
    aset,
    pilihId,
    onPilih,
    onLepas,
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
    /** Lepas pilihan: klik area terpilih sekali lagi atau klik peta kosong. */
    onLepas?: () => void;
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
    const lapis = useRef<{ poligon: L.LayerGroup; sorot: L.LayerGroup; aset: L.LayerGroup; sunting: L.LayerGroup } | null>(null);
    const lapisPer = useRef(new Map<number | string, { lyr: L.Polygon; p: PoligonTampil; luas: number }>());
    const pilihRef = useRef(pilihId);
    /** Pilihan terakhir berasal dari klik di peta: jangan pindahkan peta. */
    const dariPeta = useRef(false);
    const kanvas = useRef<L.Canvas | null>(null);
    /** Nilai `fokus` terakhir yang sudah dibingkai; -1 = peta baru (dibuat ulang), bingkai awal lagi. */
    const fokusTerakhir = useRef<number | undefined>(-1);
    const cb = useRef({ onPilih, onLepas, onSunting, onKlikPeta });
    useEffect(() => {
        cb.current = { onPilih, onLepas, onSunting, onKlikPeta };
    }, [onPilih, onLepas, onSunting, onKlikPeta]);

    useEffect(() => {
        if (!wadah.current || peta.current) return;
        const m = L.map(wadah.current, { scrollWheelZoom: true, doubleClickZoom: false }).setView(PUSAT_BAWAAN, 16);
        L.tileLayer(UBIN_PETA.url, {
            maxZoom: 20,
            maxNativeZoom: Math.min(UBIN_PETA.zoomMaksAsli, 19),
            ...(UBIN_PETA.subdomain ? { subdomains: UBIN_PETA.subdomain } : {}),
            attribution: UBIN_PETA.atribusi,
        }).addTo(m);
        // Pane sorot di atas kanvas poligon (overlayPane 400), di bawah penanda (markerPane 600).
        m.createPane("sorot").style.zIndex = "450";
        // tolerance: garis tipis tetap mudah diketuk.
        kanvas.current = L.canvas({ padding: 0.5, tolerance: 3 });
        m.getPane("sorot")!.style.pointerEvents = "none";
        lapis.current = {
            poligon: L.layerGroup().addTo(m),
            sorot: L.layerGroup().addTo(m),
            aset: L.layerGroup().addTo(m),
            sunting: L.layerGroup().addTo(m),
        };
        // Klik di peta kosong (tidak mengenai poligon mana pun): titik gambar, atau lepas pilihan.
        m.on("click", (e: L.LeafletMouseEvent) => {
            cb.current.onKlikPeta?.([Number(e.latlng.lng.toFixed(7)), Number(e.latlng.lat.toFixed(7))]);
            cb.current.onLepas?.();
        });
        // Pegangan uji E2E: proyeksi titik → piksel dan zoom dibaca dari elemen wadah.
        (wadah.current as HTMLDivElement & { petaLeaflet?: L.Map }).petaLeaflet = m;
        peta.current = m;
        return () => {
            m.remove();
            peta.current = null;
            kanvas.current = null;
            fokusTerakhir.current = -1;
        };
    }, []);

    /**
     * Klik di atas poligon atau titik aset: pilih area terkecil yang memuat titik klik (kawasan tidak
     * pernah menelan gedung di dalamnya, titik aset tidak menelan gedungnya). Klik area terpilih → lepas.
     */
    const klikArea = useRef((ll: L.LatLng, cadangan: number | string | null) => {
        const pt = { lat: ll.lat, lng: ll.lng };
        const isi = [...lapisPer.current.values()].map((x) => ({ id: x.p.id, geometry: x.p.geometry, luas: x.luas }));
        const id = areaTerkecilDi(pt, isi, (x) => x.luas)?.id ?? cadangan;
        // Saat menggambar, klik di atas area tetap menambah titik.
        cb.current.onKlikPeta?.([Number(pt.lng.toFixed(7)), Number(pt.lat.toFixed(7))]);
        if (id == null || id === pilihRef.current) {
            cb.current.onLepas?.();
            return;
        }
        // Dari peta: hanya sorot, tanpa lompatan.
        dariPeta.current = true;
        cb.current.onPilih?.(id);
    });

    // Poligon: dibangun ulang hanya bila daftar poligon berubah; memilih hanya mengganti gaya.
    useEffect(() => {
        const g = lapis.current?.poligon;
        if (!g) return;
        g.clearLayers();
        lapisPer.current.clear();
        const urut = [...poligon].sort((a, b) => Number(b.gaya === "kawasan") - Number(a.gaya === "kawasan"));
        for (const p of urut) {
            const lyr = L.polygon(keLatLng(p.geometry), {
                ...gayaPoligon(p, "biasa"),
                renderer: kanvas.current!,
                bubblingMouseEvents: false,
            }).addTo(g);
            lyr.bindTooltip(esc(p.nama), { sticky: true });
            lyr.on("click", (e: L.LeafletMouseEvent) => klikArea.current(e.latlng, p.id));
            lyr.on("mouseover", () => {
                if (pilihRef.current !== p.id) lyr.setStyle(gayaPoligon(p, "hover"));
            });
            lyr.on("mouseout", () => {
                const ada = pilihRef.current != null && lapisPer.current.has(pilihRef.current);
                lyr.setStyle(gayaPoligon(p, pilihRef.current === p.id ? "terpilih" : ada ? "redup" : "biasa"));
            });
            lapisPer.current.set(p.id, { lyr, p, luas: luasM2(p.geometry) });
        }
        const w = wadah.current;
        if (w) {
            w.dataset.poligon = String(poligon.length);
            w.dataset.poligonImpor = String(poligon.filter((p) => p.gaya === "impor").length);
        }
        // Titik aset digambar ulang supaya tetap di atas poligon di kanvas yang sama.
        lapis.current?.aset.eachLayer((l) => (l as L.CircleMarker).bringToFront());
    }, [poligon]);

    // Sorotan area terpilih: aksen tebal di atas garis putih, isi lebih pekat, sisanya diredupkan, pin di kutub label.
    useEffect(() => {
        pilihRef.current = pilihId;
        const s = lapis.current?.sorot;
        if (!s) return;
        s.clearLayers();
        const terpilih = pilihId != null ? lapisPer.current.get(pilihId) : undefined;
        for (const [id, { lyr, p }] of lapisPer.current) {
            lyr.setStyle(gayaPoligon(p, !terpilih ? "biasa" : id === pilihId ? "terpilih" : "redup"));
        }
        const w = wadah.current;
        if (w) {
            w.dataset.terpilih = terpilih ? String(pilihId) : "";
            w.dataset.redup = terpilih ? "ya" : "tidak";
        }
        // Saat menyunting simpul, poligon asli tetap transparan dan lapis sunting yang menggambar.
        if (!terpilih || sunting) return;
        const { lyr, p } = terpilih;
        // Kawasan tetap di lapis paling bawah supaya gedung di dalamnya tetap bisa disorot dan diklik.
        if (p.gaya !== "kawasan") lyr.bringToFront();
        const aksen = token("sorot-peta");
        const ll = keLatLng(p.geometry);
        L.polygon(ll, { pane: "sorot", interactive: false, color: "#fff", weight: 8, opacity: 0.95, fill: false }).addTo(s);
        L.polygon(ll, {
            pane: "sorot",
            interactive: false,
            color: aksen,
            weight: 4,
            opacity: 1,
            fillColor: aksen,
            // Kawasan menutupi seluruh peta: isinya tetap tipis supaya gedung di dalamnya terbaca.
            fillOpacity: p.gaya === "kawasan" ? 0.08 : 0.35,
            className: `poligon-terpilih sorot-denyut`,
        }).addTo(s);
        const t = titikLabel(p.geometry);
        if (t) L.marker([t.lat, t.lng], { icon: ikonPin(p), interactive: false, keyboard: false, pane: "sorot" }).addTo(s);
    }, [pilihId, poligon, sunting]);

    // Titik aset
    useEffect(() => {
        const g = lapis.current?.aset;
        if (!g) return;
        g.clearLayers();
        for (const a of aset) {
            L.circleMarker([a.lat, a.lng], {
                renderer: kanvas.current!,
                radius: 4,
                color: "#fff",
                weight: 1,
                fillColor: a.terpasang ? token("chart-3") : token("muted-foreground"),
                fillOpacity: 0.95,
                interactive: true,
                bubblingMouseEvents: false,
            })
                .bindTooltip(esc(a.kode))
                .on("click", (e: L.LeafletMouseEvent) => klikArea.current(e.latlng, null))
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

    // Bingkai: saat dimuat, pas di kawasan yang disetujui (zoom minimum dua tingkat di bawahnya,
    // supaya tidak jatuh ke tampilan kota). Pratinjau impor dan permintaan fokus lain: semua poligon.
    useEffect(() => {
        const m = peta.current;
        if (!m || fokusTerakhir.current === fokus || !poligon.length) return;
        const awal = fokusTerakhir.current === -1;
        fokusTerakhir.current = fokus;
        const kawasan = poligon.find((p) => p.gaya === "kawasan" && !p.draf);
        const impor = poligon.some((p) => p.gaya === "impor" || p.gaya === "impor-galat");
        if (kawasan && !impor) {
            const b = L.polygon(keLatLng(kawasan.geometry)).getBounds();
            m.setMinZoom(0);
            m.fitBounds(b, { padding: [12, 12], maxZoom: 18, animate: !awal && !gerakDikurangi() });
            const z = Math.min(m.getBoundsZoom(b, false, L.point(24, 24)), 18);
            m.setMinZoom(Math.max(0, z - 2));
            if (wadah.current) wadah.current.dataset.zoomMin = String(m.getMinZoom());
            return;
        }
        m.setMinZoom(0);
        const b = L.latLngBounds([]);
        for (const p of poligon) b.extend(L.polygon(keLatLng(p.geometry)).getBounds());
        if (b.isValid()) m.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
    }, [fokus, poligon]);

    // Fokus ke poligon terpilih
    useEffect(() => {
        const m = peta.current;
        const p = poligon.find((x) => x.id === pilihId);
        if (!m || !p) return;
        // Klik di peta: hanya sorot, tanpa lompatan. Dari daftar/pencarian: terbang ke poligon.
        if (dariPeta.current) {
            dariPeta.current = false;
            return;
        }
        const b = L.polygon(keLatLng(p.geometry)).getBounds();
        if (gerakDikurangi()) m.fitBounds(b, { padding: [48, 48], maxZoom: 19, animate: false });
        else m.flyToBounds(b, { padding: [48, 48], maxZoom: 19, duration: 0.7 });
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
