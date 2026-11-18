/**
 * Lembar stiker QR (SPEC §4.4, StikerController.php). Ukuran dalam milimeter, untuk kertas label
 * A4 potret yang dipotong pabrik: jangan ubah tanpa mengukur hasil cetak.
 */
export const TATA_LETAK = {
    "3x8": { kolom: 3, baris: 8, lebar: 63.5, tinggi: 33.9, nama: "24 label per lembar (63,5 x 33,9 mm)" },
    "2x5": { kolom: 2, baris: 5, lebar: 99.1, tinggi: 57.0, nama: "10 label per lembar (99,1 x 57 mm)" },
    "2x4": { kolom: 2, baris: 4, lebar: 99.1, tinggi: 67.7, nama: "8 label per lembar (99,1 x 67,7 mm)" },
} as const;
export type KodeTata = keyof typeof TATA_LETAK;
export const TATA_BAWAAN: KodeTata = "2x5";

export function parseTata(nilai: string | undefined): KodeTata {
    return nilai && nilai in TATA_LETAK ? (nilai as KodeTata) : TATA_BAWAAN;
}

/**
 * Ukuran cetak QR (termasuk quiet zone 4 modul) dan kode aset bergantung tinggi label.
 * QR dibesarkan dari 26/20 mm saat quiet zone ditambahkan supaya modulnya tidak mengecil.
 */
export function ukuranLabel(kode: KodeTata): { qrMm: number; kodeMm: number } {
    const besar = TATA_LETAK[kode].tinggi > 40;
    return { qrMm: besar ? 30 : 24, kodeMm: besar ? 4.6 : 3.8 };
}

/** "APAR-001, APAR-014 ,," → ["APAR-001", "APAR-014"] (cetak ulang satu-dua stiker). */
export function parseDaftarKode(nilai: string | undefined): string[] {
    return (nilai ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 200);
}

/** Penyaring lembar stiker dari query string. `area`: id area berpoligon disetujui, atau "belum". */
export type SaringStiker = {
    tipe: string[];
    area?: number | "belum";
    lantai?: string;
    kode: string[];
};

const satu = (v: string | string[] | undefined) =>
    typeof v === "string" && v.trim() ? v.trim() : Array.isArray(v) && v[0]?.trim() ? v[0].trim() : undefined;

export function parseSaringStiker(sp: Record<string, string | string[] | undefined>): SaringStiker {
    const area = satu(sp.area);
    const idArea = area && /^\d+$/.test(area) ? Number(area) : undefined;
    return {
        tipe: parseDaftarKode(satu(sp.tipe)).filter((t) => /^[a-z0-9_]+$/.test(t)),
        area: area === "belum" ? "belum" : idArea,
        lantai: satu(sp.lantai),
        kode: parseDaftarKode(satu(sp.kode)),
    };
}

/** Query string lembar stiker (urutan tetap, nilai kosong dibuang). */
export function qsStiker(tata: KodeTata, f: SaringStiker): string {
    const q = new URLSearchParams();
    if (tata !== TATA_BAWAAN) q.set("tata", tata);
    if (f.tipe.length) q.set("tipe", f.tipe.join(","));
    if (f.area !== undefined) q.set("area", String(f.area));
    if (f.lantai) q.set("lantai", f.lantai);
    if (f.kode.length) q.set("kode", f.kode.join(","));
    const s = q.toString();
    return s ? `?${s}` : "";
}

/**
 * CSS lembar dan label. Ukuran dalam milimeter, bukan piksel: hasil cetak harus pas di kertas label
 * yang dipotong pabrik. Aturan @media print diuji dengan snapshot (lib/__tests__/stiker.test.ts):
 * perubahan di sini harus disengaja dan diukur pada kertas.
 */
export function cssStiker(kode: KodeTata): string {
    const t = TATA_LETAK[kode];
    const { qrMm, kodeMm } = ukuranLabel(kode);
    const kecil = t.tinggi < 40;
    return `
  .stiker-lembar { width: 210mm; min-height: 297mm; background: #fff; margin: 0 auto 16px; padding: 8mm 5mm;
    display: grid; grid-template-columns: repeat(${t.kolom}, ${t.lebar}mm); grid-auto-rows: ${t.tinggi}mm;
    justify-content: center; align-content: start; box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.10); color: #000; }
  .stiker-label { width: ${t.lebar}mm; height: ${t.tinggi}mm; display: flex; align-items: center; gap: 2mm; padding: 2mm;
    overflow: hidden; outline: 1px dashed #ced4da; outline-offset: -1px; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  .stiker-qr { flex: 0 0 auto; line-height: 0; }
  .stiker-qr svg { display: block; width: ${qrMm}mm; height: auto; }
  .stiker-teks { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .stiker-jenis { display: flex; align-items: center; gap: .8mm; font-size: 2.3mm; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .stiker-jenis svg { width: ${kecil ? 3.2 : 3.8}mm; height: ${kecil ? 3.2 : 3.8}mm; flex: 0 0 auto; stroke-width: 2.25; }
  .stiker-kode { font-size: ${kodeMm}mm; font-weight: 800; letter-spacing: .2px; line-height: 1.1; margin-top: .4mm; }
  .stiker-area { font-size: 2.5mm; font-weight: 700; line-height: 1.2; margin-top: .6mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stiker-lokasi { font-size: 2.3mm; line-height: 1.2; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${kecil ? 1 : 2}; overflow: hidden; }
  .stiker-perintah { display: flex; align-items: center; gap: .8mm; font-size: 2.3mm; font-weight: 700; margin-top: ${kecil ? .6 : 1.2}mm;
    padding-top: ${kecil ? .5 : .9}mm; border-top: .3mm solid #000; }
  .stiker-perintah svg { width: 2.8mm; height: 2.8mm; flex: 0 0 auto; stroke-width: 2.5; }
  .stiker-token { font-family: ui-monospace, 'Courier New', monospace; font-size: 1.9mm; color: #333;
    word-break: normal; overflow-wrap: anywhere; line-height: 1.2; margin-top: .5mm; }
  @media screen and (max-width: 879px) and (min-width: 640px) { .stiker-pratinjau-isi { zoom: .72; } }
  @media screen and (max-width: 639px) { .stiker-pratinjau-isi { zoom: .38; } }
  @media print {
    html, body { background: #fff !important; }
    .stiker-layar { display: none !important; }
    #isi { margin: 0 !important; padding: 0 !important; max-width: none !important; }
    .stiker-pratinjau { margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important;
      box-shadow: none !important; overflow: visible !important; border-radius: 0 !important; }
    .stiker-pratinjau-isi { zoom: 1 !important; }
    .stiker-lembar { margin: 0; box-shadow: none; padding: 8mm 5mm; break-after: page; }
    .stiker-lembar:last-child { break-after: auto; }
    .stiker-label { outline: none; }
    @page { size: A4 portrait; margin: 0; }
  }`;
}

export function bagiLembar<T>(daftar: T[], perLembar: number): T[][] {
    const hasil: T[][] = [];
    for (let i = 0; i < daftar.length; i += perLembar) hasil.push(daftar.slice(i, i + perLembar));
    return hasil;
}

/** Isi QR: URL lengkap, supaya kamera bawaan ponsel pun bisa membukanya (SPEC §3.1). */
export function urlStiker(origin: string, token: string): string {
    return `${origin.replace(/\/+$/, "")}/i/${token}`;
}
