import { ImageResponse } from "next/og";

export const alt = "Panduan mencoba Inspeksi K3: inspektur, admin, dan pemantau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MODUL = [
    { nama: "APAR", warna: "#c8432b", rona: "#fbe7e2" },
    { nama: "P3K", warna: "#23845a", rona: "#e0f1e8" },
    { nama: "Hydrant", warna: "#2c64a6", rona: "#e2ebf6" },
    { nama: "Damkar", warna: "#b7790a", rona: "#f8edd3" },
];

/** Gambar pratinjau tautan /panduan (WhatsApp, Telegram): tanpa merek pihak lain. */
export default function Gambar() {
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#031e25", color: "#fff", padding: 72 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30, fontWeight: 700 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f5b700", display: "flex", alignItems: "center", justifyContent: "center", color: "#031e25", fontSize: 30, fontWeight: 800 }}>
                        K3
                    </div>
                    Geofence Inspection K3
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Panduan mencoba, langkah demi langkah</div>
                    <div style={{ fontSize: 32, color: "rgba(255,255,255,0.75)" }}>Inspektur di HP · Admin K3 dan Pemantau di laptop · sekitar 30 menit</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                    {MODUL.map((m) => (
                        <div key={m.nama} style={{ display: "flex", alignItems: "center", gap: 12, background: m.rona, color: m.warna, borderRadius: 999, padding: "12px 24px", fontSize: 26, fontWeight: 700 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 999, background: m.warna }} />
                            {m.nama}
                        </div>
                    ))}
                </div>
            </div>
        ),
        size,
    );
}
