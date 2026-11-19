/**
 * Jejak audit dalam bahasa sehari-hari. Kunci aksi mentah (mis. "area.pasang_aset") dan isi
 * `data` JSON diterjemahkan menjadi kalimat Indonesia, satu ikon, satu kategori, dan tabel
 * "sebelum → sesudah". Murni (tanpa basis data): nama area/aset/pengguna datang lewat `Rujukan`
 * yang disiapkan peladen (server/audit.ts) dari `idRujukan`.
 *
 * Koordinat tidak pernah ditampilkan (denah bersifat rahasia, ADR-10), termasuk di "Data teknis".
 */
import { formatAngka, formatTanggal } from "@/lib/format";
import {
    LABEL_AREA_JENIS,
    LABEL_GATE_ALASAN,
    LABEL_HASIL_TINJAUAN,
    ROLE_LABEL,
    type AreaJenis,
    type GateAlasan,
    type GateStatus,
    type HasilTinjauan,
    type Role,
} from "@/lib/domain/constants";
import { LABEL_GERBANG } from "./label";

/* ---------- kategori ---------- */

export const KATEGORI_AUDIT = {
    area: { label: "Area & peta", awalan: ["area"] },
    aset: { label: "Aset & stiker", awalan: ["aset", "stiker"] },
    inspeksi: { label: "Inspeksi", awalan: ["inspeksi"] },
    pengguna: { label: "Pengguna", awalan: ["pengguna"] },
    masuk: { label: "Masuk aplikasi", awalan: ["masuk"] },
    jadwal: { label: "Jadwal", awalan: ["tipe", "cron", "jadwal"] },
    lainnya: { label: "Lainnya", awalan: [] },
} as const satisfies Record<string, { label: string; awalan: readonly string[] }>;

export type KategoriAudit = keyof typeof KATEGORI_AUDIT;

export const SEMUA_AWALAN_DIKENAL: string[] = Object.values(KATEGORI_AUDIT).flatMap((k) => [...k.awalan]);

export function kategoriDari(aksi: string): KategoriAudit {
    const awalan = aksi.split(".")[0] ?? "";
    for (const [k, v] of Object.entries(KATEGORI_AUDIT)) {
        if ((v.awalan as readonly string[]).includes(awalan)) return k as KategoriAudit;
    }
    return "lainnya";
}

export function adalahKategori(v: unknown): v is KategoriAudit {
    return typeof v === "string" && Object.hasOwn(KATEGORI_AUDIT, v);
}

/* ---------- jenis data ---------- */

export type BarisAudit = {
    id: number;
    aksi: string;
    entitas: string | null;
    entitasId: string | null;
    data: Record<string, unknown> | null;
    ip: string | null;
    createdAt: Date;
    userId: number | null;
    oleh: string | null;
    olehNip: string | null;
};

export type InfoArea = { nama: string; aktif: boolean };

/** Nama yang masih ada untuk id yang dirujuk jejak. Id yang tidak ada di sini = sudah dihapus. */
export type Rujukan = {
    area: Map<number, InfoArea>;
    /** "APAR 01D" */
    aset: Map<number, string>;
    /** inspeksi (uuid) → label aset yang diperiksa */
    inspeksi: Map<string, string>;
    pengguna: Map<number, { nama: string; nip: string }>;
    tipe: Map<number, string>;
    divisi: Map<number, string>;
};

export const rujukanKosong = (): Rujukan => ({
    area: new Map(),
    aset: new Map(),
    inspeksi: new Map(),
    pengguna: new Map(),
    tipe: new Map(),
    divisi: new Map(),
});

export type NamaIkon =
    | "masuk"
    | "masuk-gagal"
    | "setujui"
    | "impor"
    | "ubah"
    | "hapus"
    | "pasang"
    | "lepas"
    | "kawasan"
    | "draf"
    | "buang"
    | "buat-area"
    | "inspeksi"
    | "tolak-lokasi"
    | "tinjau"
    | "tambah-pengguna"
    | "pengguna"
    | "aktifkan"
    | "nonaktifkan"
    | "kunci"
    | "jadwal"
    | "aset"
    | "qr"
    | "lihat"
    | "cetak"
    | "sistem"
    | "lain";

/** Potongan kalimat: teks biasa, atau nama yang ditebalkan. */
export type Potongan = string | { tegas: string };

/** Satu baris tabel detail. `dari` hadir hanya untuk perubahan (sebelum → sesudah). */
export type BarisDetail = { bidang: string; dari?: string; ke: string };

export type Uraian = {
    ikon: NamaIkon;
    kategori: KategoriAudit;
    /** Label pendek aksi, mis. "Memasangkan aset". */
    label: string;
    /** Pelaku (nama pengguna, "Sistem", atau "Seseorang"). */
    pelaku: string;
    /** Sisa kalimat setelah pelaku. */
    kalimat: Potongan[];
    detail: BarisDetail[];
    /** `data` mentah tanpa koordinat, untuk "Data teknis". */
    teknis: Record<string, unknown> | null;
};

/* ---------- pembantu ---------- */

const ANGKA = /^\d+$/;
const angka = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && ANGKA.test(v) ? Number(v) : null;
const teks = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const objek = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const daftarAngka = (v: unknown): number[] =>
    Array.isArray(v) ? v.map(angka).filter((n): n is number => n !== null) : [];

const yaTidak = (v: unknown) => (v === true ? "Ya" : v === false ? "Tidak" : "-");
const kosong = (v: unknown) => v === null || v === undefined || v === "";
const tampil = (v: unknown): string => {
    if (kosong(v)) return "(kosong)";
    if (typeof v === "boolean") return yaTidak(v);
    if (typeof v === "number") return formatAngka(v, 2);
    if (typeof v === "string") return v;
    return JSON.stringify(v);
};

/** Kunci yang memuat koordinat atau bentuk peta: tidak pernah ditampilkan. */
const KUNCI_KOORDINAT =
    /^(lat|lng|lon|long|latitude|longitude|geometry|geometri|polygon|polygondraf|coordinates|koordinat|titik)$/i;

/** Salinan `data` tanpa koordinat (berulang ke dalam objek dan larik). */
export function tanpaKoordinat(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(tanpaKoordinat);
    const o = objek(v);
    if (!o) return v;
    const hasil: Record<string, unknown> = {};
    for (const [k, isi] of Object.entries(o)) {
        if (KUNCI_KOORDINAT.test(k)) continue;
        hasil[k] = tanpaKoordinat(isi);
    }
    return hasil;
}

/** "area #240 (sudah dihapus)" bila id tidak ditemukan lagi. */
export function namaArea(r: Rujukan, id: unknown, cadangan?: string | null): string {
    const n = angka(id);
    const a = n === null ? undefined : r.area.get(n);
    if (a) return a.aktif ? a.nama : `${a.nama} (sudah dihapus)`;
    if (cadangan) return `${cadangan} (sudah dihapus)`;
    return n === null ? "area tak dikenal" : `area #${n} (sudah dihapus)`;
}

export function namaAset(r: Rujukan, id: unknown, cadangan?: string | null): string {
    const n = angka(id);
    const a = n === null ? undefined : r.aset.get(n);
    if (a) return a;
    if (cadangan) return cadangan;
    return n === null ? "aset tak dikenal" : `aset #${n} (sudah dihapus)`;
}

function namaPengguna(r: Rujukan, id: unknown, nip?: string | null): string {
    const n = angka(id);
    const p = n === null ? undefined : r.pengguna.get(n);
    if (p) return `${p.nama} (NIP ${p.nip})`;
    if (nip) return `NIP ${nip}`;
    return n === null ? "pengguna tak dikenal" : `pengguna #${n} (sudah dihapus)`;
}

/** "APAR 01D", "APAR 01D dan APAR 02D", "APAR 01D, APAR 02D, APAR 03D, dan 4 lainnya". */
export function daftarNamaAset(r: Rujukan, ids: number[], maks = 3): string {
    const nama = ids.slice(0, maks).map((id) => namaAset(r, id));
    const sisa = ids.length - nama.length;
    if (sisa > 0) return `${nama.join(", ")}, dan ${sisa} lainnya`;
    if (nama.length <= 2) return nama.join(" dan ");
    return `${nama.slice(0, -1).join(", ")}, dan ${nama.at(-1)}`;
}

const labelPeran = (v: unknown) => ROLE_LABEL[v as Role] ?? tampil(v);

/* ---------- tabel perubahan ---------- */

type Penampil = (v: unknown, r: Rujukan) => string;
type DefBidang = { label: string; tampil?: Penampil };

const tampilArea: Penampil = (v, r) => (kosong(v) ? "(tanpa area)" : namaArea(r, v));
const tampilDivisi: Penampil = (v, r) => {
    const n = angka(v);
    if (n === null) return "(tanpa divisi)";
    return r.divisi.get(n) ?? `divisi #${n}`;
};
const tampilTipe: Penampil = (v, r) => {
    const n = angka(v);
    return n === null ? tampil(v) : (r.tipe.get(n) ?? `tipe #${n}`);
};
const tampilTanggal: Penampil = (v) => (teks(v) ? formatTanggal(String(v)) : "(kosong)");

const BIDANG_AREA: Record<string, DefBidang> = {
    nama: { label: "Nama" },
    kode: { label: "Kode area" },
    jenis: { label: "Jenis", tampil: (v) => LABEL_AREA_JENIS[v as AreaJenis] ?? tampil(v) },
    divisionId: { label: "Divisi", tampil: tampilDivisi },
    restricted: { label: "Area terbatas", tampil: yaTidak },
};

const BIDANG_ASET: Record<string, DefBidang> = {
    assetTypeId: { label: "Tipe objek", tampil: tampilTipe },
    kode: { label: "Nomor aset" },
    divisionId: { label: "Divisi", tampil: tampilDivisi },
    aktif: { label: "Status", tampil: (v) => (v === true ? "Aktif" : v === false ? "Nonaktif" : tampil(v)) },
    areaId: { label: "Area", tampil: tampilArea },
    gedung: { label: "Gedung (teks lama)" },
    lantai: { label: "Lantai" },
    lokasiTeks: { label: "Keterangan lokasi" },
    tglExpired: { label: "Tanggal kedaluwarsa", tampil: tampilTanggal },
    radiusM: { label: "Radius gerbang (m)" },
};

const BIDANG_ATRIBUT: Record<string, DefBidang> = {
    jenis: { label: "Jenis isi" },
    kapasitas_kg: { label: "Kapasitas (kg)" },
};

function bandingkan(
    dari: Record<string, unknown>,
    ke: Record<string, unknown>,
    defs: Record<string, DefBidang>,
    r: Rujukan,
): BarisDetail[] {
    const hasil: BarisDetail[] = [];
    let titikBerubah = false;
    for (const k of new Set([...Object.keys(dari), ...Object.keys(ke)])) {
        const a = dari[k] ?? null;
        const b = ke[k] ?? null;
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        // `titikPeta`: tanda titik berubah tanpa nilai (baris sejak 19 Nov 2026); lat/lng: baris lama.
        if (KUNCI_KOORDINAT.test(k) || k === "titikPeta") {
            titikBerubah = true;
            continue;
        }
        if (k === "attributes") {
            hasil.push(...bandingkan(objek(a) ?? {}, objek(b) ?? {}, BIDANG_ATRIBUT, r));
            continue;
        }
        const def = defs[k] ?? { label: k };
        const f = def.tampil ?? ((v: unknown) => tampil(v));
        hasil.push({ bidang: def.label, dari: f(a, r), ke: f(b, r) });
    }
    if (titikBerubah)
        hasil.push({ bidang: "Titik di peta", dari: "titik lama", ke: "dipindah (koordinat tidak ditampilkan)" });
    return hasil;
}

/** aset.ubah menyimpan `berubah: {kolom: {dari, ke}}`. */
function perubahanAset(berubah: unknown, r: Rujukan): BarisDetail[] {
    const o = objek(berubah) ?? {};
    const dari: Record<string, unknown> = {};
    const ke: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
        const p = objek(v);
        dari[k] = p?.dari ?? null;
        ke[k] = p?.ke ?? null;
    }
    return bandingkan(dari, ke, BIDANG_ASET, r);
}

/** "nama, kode, dan divisi" (huruf kecil, untuk di dalam kalimat). */
function daftarBidang(d: BarisDetail[]): string {
    const n = [...new Set(d.map((x) => x.bidang.toLowerCase()))];
    if (n.length <= 2) return n.join(" dan ");
    return `${n.slice(0, -1).join(", ")}, dan ${n.at(-1)}`;
}

/* ---------- uraian per aksi ---------- */

type Konteks = { b: BarisAudit; d: Record<string, unknown>; r: Rujukan; id: number | null };
type HasilUraian = Pick<Uraian, "ikon" | "label" | "kalimat"> & { detail?: BarisDetail[]; pelaku?: string };
type Penerjemah = (k: Konteks) => HasilUraian;

const areaIni = (k: Konteks): Potongan => ({ tegas: namaArea(k.r, k.id, teks(k.d.nama)) });

const PENERJEMAH: Record<string, Penerjemah> = {
    masuk: () => ({ ikon: "masuk", label: "Masuk", kalimat: ["masuk ke aplikasi"] }),
    "masuk.gagal": ({ b, d }) => ({
        ikon: "masuk-gagal",
        label: "Gagal masuk",
        pelaku: b.oleh ?? "Seseorang",
        kalimat: b.oleh
            ? ["gagal masuk: kata sandi salah"]
            : ["mencoba masuk dengan NIP ", { tegas: teks(d.nip) ?? "-" }, " tetapi gagal"],
    }),

    "area.setujui": (k) => ({
        ikon: "setujui",
        label: "Menyetujui poligon",
        kalimat: ["menyetujui poligon ", areaIni(k)],
    }),
    "area.draf": (k) => ({
        ikon: "draf",
        label: "Menyimpan draf poligon",
        kalimat: ["menyimpan draf poligon ", areaIni(k)],
    }),
    "area.buang_draf": (k) => ({
        ikon: "buang",
        label: "Membuang draf poligon",
        kalimat: ["membuang draf poligon ", areaIni(k)],
    }),
    "area.buat": (k) => ({
        ikon: "buat-area",
        label: "Menggambar area",
        kalimat: ["menggambar area baru ", areaIni(k)],
    }),
    "area.kawasan": (k) => ({
        ikon: "kawasan",
        label: "Menetapkan batas kawasan",
        kalimat: ["menjadikan ", areaIni(k), " batas kawasan"],
    }),
    "area.hapus": (k) => {
        const lepas = angka(k.d.asetDilepas) ?? 0;
        return {
            ikon: "hapus",
            label: "Menghapus area",
            kalimat: [
                "menghapus area ",
                { tegas: teks(k.d.nama) ?? namaArea(k.r, k.id) },
                lepas ? ` dan melepas ${lepas} aset darinya` : "",
            ],
            detail: [{ bidang: "Aset yang dilepas", ke: String(lepas) }],
        };
    },
    "area.impor": ({ d }) => {
        const jumlah = angka(d.jumlah) ?? 0;
        const baru = angka(d.baru) ?? 0;
        const diisi = angka(d.diisi) ?? 0;
        return {
            ikon: "impor",
            label: "Mengimpor poligon",
            kalimat: [`mengimpor ${formatAngka(jumlah)} poligon dari berkas peta sebagai draf`],
            detail: [
                { bidang: "Poligon di berkas", ke: formatAngka(jumlah) },
                { bidang: "Area baru", ke: formatAngka(baru) },
                { bidang: "Melengkapi area yang sudah ada", ke: formatAngka(diisi) },
            ],
        };
    },
    "area.hapus_draf_massal": ({ d }) => {
        const dihapus = angka(d.dihapus) ?? 0;
        const diminta = angka(d.diminta) ?? dihapus;
        return {
            ikon: "hapus",
            label: "Menghapus draf area",
            kalimat: [
                `menghapus ${formatAngka(dihapus)} draf area sekaligus`,
                diminta !== dihapus ? ` (${formatAngka(diminta - dihapus)} dilewati karena masih dipakai)` : "",
            ],
            detail: [
                { bidang: "Dipilih", ke: formatAngka(diminta) },
                { bidang: "Terhapus", ke: formatAngka(dihapus) },
            ],
        };
    },
    "area.ubah": (k) => {
        const dari = objek(k.d.dari) ?? {};
        const ke = objek(k.d.ke) ?? {};
        const detail = bandingkan(dari, ke, BIDANG_AREA, k.r);
        const namaLama = teks(dari.nama);
        const namaBaru = teks(ke.nama);
        const sasaran: Potongan = { tegas: namaArea(k.r, k.id, namaBaru) };
        if (namaLama && namaBaru && namaLama !== namaBaru) {
            const lain = detail.filter((x) => x.bidang !== "Nama");
            return {
                ikon: "ubah",
                label: "Mengubah area",
                kalimat: [
                    "mengubah nama ",
                    { tegas: `“${namaLama}”` },
                    " menjadi ",
                    { tegas: `“${namaBaru}”` },
                    lain.length ? `, juga mengubah ${daftarBidang(lain)}` : "",
                ],
                detail,
            };
        }
        if (!detail.length) {
            return {
                ikon: "ubah",
                label: "Menyimpan area",
                kalimat: ["menyimpan area ", sasaran, " tanpa perubahan"],
                detail,
            };
        }
        return {
            ikon: "ubah",
            label: "Mengubah area",
            kalimat: [`mengubah ${daftarBidang(detail)} area `, sasaran],
            detail,
        };
    },
    "area.pasang_aset": (k) => {
        const ids = daftarAngka(k.d.assetIds);
        const otomatis = k.d.otomatis === true;
        const jumlah = `${formatAngka(ids.length)} aset`;
        const rincian = ids.length ? ` (${daftarNamaAset(k.r, ids)})` : "";
        const detail = ids.length > 3 ? [{ bidang: "Aset", ke: ids.map((id) => namaAset(k.r, id)).join(", ") }] : [];
        if (k.id === null) {
            return {
                ikon: "lepas",
                label: "Melepas aset dari area",
                kalimat: [`melepas ${jumlah}${rincian} dari areanya`],
                detail,
            };
        }
        return {
            ikon: "pasang",
            label: "Memasangkan aset",
            kalimat: [
                `memasangkan ${jumlah}${rincian} ke `,
                areaIni(k),
                otomatis ? " menurut titiknya di dalam poligon" : "",
            ],
            detail,
        };
    },

    "aset.buat": (k) => ({
        ikon: "aset",
        label: "Menambah aset",
        kalimat: ["menambahkan aset ", { tegas: namaAset(k.r, k.id, teks(k.d.kode)) }],
    }),
    "aset.ubah": (k) => {
        const detail = perubahanAset(k.d.berubah, k.r);
        const sasaran: Potongan = { tegas: namaAset(k.r, k.id, teks(k.d.kode)) };
        if (!detail.length)
            return { ikon: "ubah", label: "Menyimpan aset", kalimat: ["menyimpan aset ", sasaran, " tanpa perubahan"] };
        return {
            ikon: "ubah",
            label: "Mengubah aset",
            kalimat: [`mengubah ${daftarBidang(detail)} aset `, sasaran],
            detail,
        };
    },
    "aset.ganti_token": (k) => ({
        ikon: "qr",
        label: "Mengganti kode QR",
        kalimat: [
            "mengganti kode QR aset ",
            { tegas: namaAset(k.r, k.id, teks(k.d.kode)) },
            " (stiker lama tidak berlaku lagi)",
        ],
    }),
    "aset.taruh_di_area": ({ d }) => ({
        ikon: "pasang",
        label: "Menaruh aset di area",
        kalimat: [`menaruh ${formatAngka(angka(d.jumlah) ?? 0)} aset di dalam poligon area-nya`],
    }),
    "aset.tempatkan_ulang": ({ d }) => {
        const per = d.perGedung && typeof d.perGedung === "object" ? Object.entries(d.perGedung as Record<string, unknown>) : [];
        return {
            ikon: "pasang",
            label: "Menempatkan ulang aset di denah",
            kalimat: [
                `menempatkan ${formatAngka(angka(d.jumlah) ?? 0)} aset di dalam kawasan galangan sesuai denah yang disetujui`,
                ...(teks(d.alasan) ? [` (${String(d.alasan)})`] : []),
            ],
            detail: per.map(([g, n]) => ({ bidang: g, ke: `${formatAngka(angka(n) ?? 0)} aset` })),
        };
    },
    "aset.pulihkan_tempat": ({ d }) => ({
        ikon: "buang",
        label: "Memulihkan letak aset",
        kalimat: [`memulihkan letak dan area ${formatAngka(angka(d.jumlah) ?? 0)} aset ke keadaan sebelum penempatan ulang`],
    }),
    "aset.lihat_token": (k) => ({
        ikon: "lihat",
        label: "Melihat kode QR",
        kalimat: ["melihat kode QR aset ", { tegas: namaAset(k.r, k.id, teks(k.d.kode)) }],
    }),
    "stiker.lihat": ({ d }) => {
        const jumlah = angka(d.jumlah) ?? 0;
        const kode = Array.isArray(d.kode) ? d.kode.filter((x): x is string => typeof x === "string") : [];
        return {
            ikon: "cetak",
            label: "Membuka lembar stiker",
            kalimat: [`membuka lembar cetak stiker QR untuk ${formatAngka(jumlah)} aset`],
            detail: [
                { bidang: "Jumlah stiker", ke: formatAngka(jumlah) },
                ...(teks(d.tata) ? [{ bidang: "Tata letak", ke: String(d.tata).replace("x", " × ") }] : []),
                ...(kode.length ? [{ bidang: "Nomor aset dipilih", ke: kode.join(", ") }] : []),
            ],
        };
    },

    "inspeksi.final": (k) => {
        const gate = teks(k.d.gateStatus) as GateStatus | null;
        const alasan = teks(k.d.gateAlasan) as GateAlasan | null;
        const lokasi = gate ? (LABEL_GERBANG[gate]?.label ?? gate) : null;
        return {
            ikon: "inspeksi",
            label: "Menyelesaikan inspeksi",
            kalimat: [
                "menyelesaikan inspeksi ",
                { tegas: k.r.inspeksi.get(k.b.entitasId ?? "") ?? "aset yang sudah dihapus" },
                lokasi ? ` (lokasi: ${lokasi.toLowerCase()})` : "",
            ],
            detail: [
                ...(lokasi ? [{ bidang: "Pemeriksaan lokasi", ke: lokasi }] : []),
                ...(alasan ? [{ bidang: "Alasan", ke: LABEL_GATE_ALASAN[alasan] ?? alasan }] : []),
                ...("restrictedArea" in k.d ? [{ bidang: "Di area terbatas", ke: yaTidak(k.d.restrictedArea) }] : []),
                ...("offline" in k.d ? [{ bidang: "Dikirim saat luring", ke: yaTidak(k.d.offline) }] : []),
                ...("qrVerified" in k.d ? [{ bidang: "QR dipindai", ke: yaTidak(k.d.qrVerified) }] : []),
            ],
        };
    },
    "inspeksi.ditolak_lokasi": (k) => {
        const jarak =
            angka(k.d.jarakKeKawasanM) ?? (typeof k.d.jarakKeKawasanM === "number" ? k.d.jarakKeKawasanM : null);
        const jarakArea = typeof k.d.jarakKeAreaM === "number" ? k.d.jarakKeAreaM : null;
        const akurasi = typeof k.d.akurasi === "number" ? k.d.akurasi : null;
        return {
            ikon: "tolak-lokasi",
            label: "Inspeksi ditolak (lokasi)",
            kalimat: [
                "mencoba menginspeksi ",
                { tegas: namaAset(k.r, k.d.assetId) },
                jarak !== null
                    ? ` dari ${formatAngka(jarak)} m di luar kawasan, ditolak`
                    : " dari luar kawasan, ditolak",
            ],
            detail: [
                ...(jarak !== null ? [{ bidang: "Jarak ke kawasan", ke: `${formatAngka(jarak)} m` }] : []),
                ...(jarakArea !== null ? [{ bidang: "Jarak ke area aset", ke: `${formatAngka(jarakArea)} m` }] : []),
                ...(akurasi !== null ? [{ bidang: "Ketelitian GPS", ke: `± ${formatAngka(akurasi)} m` }] : []),
            ],
        };
    },
    "inspeksi.tinjau": (k) => {
        const hasil = teks(k.d.hasil) as HasilTinjauan | null;
        const label = hasil ? (LABEL_HASIL_TINJAUAN[hasil] ?? hasil) : null;
        const gate = teks(k.d.gate) as GateStatus | null;
        return {
            ikon: "tinjau",
            label: "Meninjau inspeksi",
            kalimat: [
                hasil === "ditolak" ? "menolak" : hasil === "diterima" ? "menerima" : "meninjau",
                " inspeksi ",
                { tegas: k.r.inspeksi.get(k.b.entitasId ?? "") ?? "aset yang sudah dihapus" },
            ],
            detail: [
                ...(label ? [{ bidang: "Keputusan", ke: label }] : []),
                ...(gate ? [{ bidang: "Pemeriksaan lokasi", ke: LABEL_GERBANG[gate]?.label ?? gate }] : []),
                ...("areaTerbatas" in k.d ? [{ bidang: "Di area terbatas", ke: yaTidak(k.d.areaTerbatas) }] : []),
                ...(teks(k.d.peran) ? [{ bidang: "Ditinjau sebagai", ke: labelPeran(k.d.peran) }] : []),
            ],
        };
    },

    "pengguna.buat": (k) => ({
        ikon: "tambah-pengguna",
        label: "Menambah pengguna",
        kalimat: [
            "menambahkan pengguna ",
            { tegas: namaPengguna(k.r, k.id, teks(k.d.nip)) },
            teks(k.d.role) ? ` sebagai ${labelPeran(k.d.role)}` : "",
        ],
    }),
    "pengguna.ubah": (k) => {
        const detail: BarisDetail[] = [];
        const peran = objek(k.d.peran);
        if (peran) detail.push({ bidang: "Peran", dari: labelPeran(peran.dari), ke: labelPeran(peran.ke) });
        if (typeof k.d.aktif === "boolean")
            detail.push({
                bidang: "Status akun",
                dari: k.d.aktif ? "Nonaktif" : "Aktif",
                ke: k.d.aktif ? "Aktif" : "Nonaktif",
            });
        if (k.d.sandiDiganti === true) detail.push({ bidang: "Kata sandi", ke: "diganti (tidak dicatat)" });
        return {
            ikon: "pengguna",
            label: "Mengubah pengguna",
            kalimat: [
                detail.length ? `mengubah ${daftarBidang(detail)} ` : "mengubah data ",
                { tegas: namaPengguna(k.r, k.id, teks(k.d.nip)) },
            ],
            detail,
        };
    },
    "pengguna.aktifkan": (k) => ({
        ikon: "aktifkan",
        label: "Mengaktifkan akun",
        kalimat: ["mengaktifkan akun ", { tegas: namaPengguna(k.r, k.id, teks(k.d.nip)) }],
    }),
    "pengguna.nonaktifkan": (k) => ({
        ikon: "nonaktifkan",
        label: "Menonaktifkan akun",
        kalimat: ["menonaktifkan akun ", { tegas: namaPengguna(k.r, k.id, teks(k.d.nip)) }],
    }),
    "pengguna.terbitkan_sandi": (k) => ({
        ikon: "kunci",
        label: "Menerbitkan sandi",
        kalimat: ["menerbitkan kata sandi sementara untuk ", { tegas: namaPengguna(k.r, k.id, teks(k.d.nip)) }],
    }),

    "jadwal.rencana": (k) => {
        const nama = k.id !== null ? (k.r.tipe.get(k.id) ?? `tipe #${k.id}`) : "peralatan";
        const tanggal = teks(k.d.tanggal);
        return {
            ikon: "jadwal",
            label: "Menjadwalkan pemeriksaan",
            kalimat: [
                "menjadwalkan pemeriksaan ",
                { tegas: nama },
                ` di ${teks(k.d.tempat) ?? "tanpa gedung"}`,
                tanggal ? ` pada ${formatTanggal(`${tanggal}T12:00:00+07:00`, { day: "numeric", month: "long", year: "numeric" })}` : "",
                angka(k.d.jumlah) !== null ? ` (${angka(k.d.jumlah)} unit)` : "",
            ],
        };
    },
    "jadwal.batal_rencana": (k) => {
        const nama = k.id !== null ? (k.r.tipe.get(k.id) ?? `tipe #${k.id}`) : "peralatan";
        return {
            ikon: "jadwal",
            label: "Melepas jadwal",
            kalimat: ["melepas jadwal pemeriksaan ", { tegas: nama }, ` di ${teks(k.d.tempat) ?? "tanpa gedung"}`],
        };
    },

    "tipe.ubah_periode": (k) => {
        const dari = angka(k.d.dari);
        const ke = angka(k.d.ke);
        const nama =
            k.id !== null
                ? (k.r.tipe.get(k.id) ?? teks(k.d.slug) ?? `tipe #${k.id}`)
                : (teks(k.d.slug) ?? "tipe objek");
        return {
            ikon: "jadwal",
            label: "Mengubah periode inspeksi",
            kalimat: [
                dari !== null && dari === ke ? "menyimpan jadwal inspeksi " : "mengubah jadwal inspeksi ",
                { tegas: nama },
                dari !== null && ke !== null
                    ? dari === ke
                        ? ` tanpa perubahan (tetap tiap ${ke} hari)`
                        : ` dari tiap ${dari} hari menjadi tiap ${ke} hari`
                    : "",
            ],
            detail:
                dari !== null && ke !== null && dari !== ke
                    ? [{ bidang: "Periode inspeksi", dari: `tiap ${dari} hari`, ke: `tiap ${ke} hari` }]
                    : [],
        };
    },
    "cron.jadwal": ({ d }) => {
        const baru = objek(d.jadwalBaru) ?? {};
        const totalBaru = Object.values(baru).reduce<number>((s, v) => s + (angka(v) ?? 0), 0);
        const terlewat = angka(d.terlewat) ?? 0;
        const segera = angka(d.segera) ?? 0;
        const periode = teks(d.periode);
        return {
            ikon: "sistem",
            label: "Menyusun jadwal",
            pelaku: "Sistem",
            kalimat: [
                `menyusun jadwal inspeksi${periode ? ` periode ${formatTanggal(periode, { month: "long", year: "numeric" })}` : ""}: `,
                `${formatAngka(totalBaru)} jadwal baru, ${formatAngka(terlewat)} terlewat`,
            ],
            detail: [
                { bidang: "Jadwal baru", ke: formatAngka(totalBaru) },
                { bidang: "Ditautkan ke inspeksi", ke: formatAngka(angka(d.ditautkan) ?? 0) },
                { bidang: "Terlewat", ke: formatAngka(terlewat) },
                { bidang: "Jatuh tempo segera", ke: formatAngka(segera) },
            ],
        };
    },
};

/** Semua kunci aksi yang punya kalimat. Kunci lain tetap tampil sebagai "melakukan aksi …". */
export const AKSI_DIKENAL = Object.keys(PENERJEMAH);

/** Menerjemahkan satu baris jejak menjadi kalimat dan detail yang bisa dibaca orang awam. */
export function uraikan(b: BarisAudit, r: Rujukan): Uraian {
    const d = objek(b.data) ?? {};
    const id = b.entitasId && ANGKA.test(b.entitasId) ? Number(b.entitasId) : null;
    const f = PENERJEMAH[b.aksi];
    const h: HasilUraian = f
        ? f({ b, d, r, id })
        : {
              ikon: "lain",
              label: "Aksi lain",
              kalimat: ["melakukan aksi ", { tegas: b.aksi.replace(/[._]/g, " ") }],
          };
    return {
        ikon: h.ikon,
        kategori: kategoriDari(b.aksi),
        label: h.label,
        pelaku: h.pelaku ?? b.oleh ?? (b.userId === null ? "Sistem" : "Pengguna yang sudah dihapus"),
        kalimat: h.kalimat.filter((p) => p !== ""),
        detail: h.detail ?? [],
        teknis: b.data ? (tanpaKoordinat(b.data) as Record<string, unknown>) : null,
    };
}

/** Kalimat utuh sebagai teks biasa (untuk uji dan aria-label). */
export function kalimatTeks(u: Pick<Uraian, "pelaku" | "kalimat">): string {
    return `${u.pelaku} ${u.kalimat.map((p) => (typeof p === "string" ? p : p.tegas)).join("")}`;
}

/* ---------- id yang perlu dicari namanya ---------- */

export type IdRujukan = {
    area: Set<number>;
    aset: Set<number>;
    inspeksi: Set<string>;
    pengguna: Set<number>;
    tipe: Set<number>;
    divisi: Set<number>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mengumpulkan semua id yang dirujuk satu halaman jejak, supaya namanya dicari sekali jalan. */
export function idRujukan(rows: Pick<BarisAudit, "aksi" | "entitas" | "entitasId" | "data">[]): IdRujukan {
    const ids: IdRujukan = {
        area: new Set(),
        aset: new Set(),
        inspeksi: new Set(),
        pengguna: new Set(),
        tipe: new Set(),
        divisi: new Set(),
    };
    const tambah = (s: Set<number>, v: unknown) => {
        const n = angka(v);
        if (n !== null) s.add(n);
    };
    for (const b of rows) {
        const d = objek(b.data) ?? {};
        const eid = b.entitasId ?? "";
        if (b.entitas === "area") tambah(ids.area, eid);
        if (b.entitas === "asset") tambah(ids.aset, eid);
        if (b.entitas === "user") tambah(ids.pengguna, eid);
        if (b.entitas === "asset_type") tambah(ids.tipe, eid);
        if (b.entitas === "inspection" && UUID.test(eid)) ids.inspeksi.add(eid);
        for (const a of daftarAngka(d.assetIds)) ids.aset.add(a);
        tambah(ids.aset, d.assetId);
        if (b.aksi === "area.ubah") {
            tambah(ids.divisi, objek(d.dari)?.divisionId);
            tambah(ids.divisi, objek(d.ke)?.divisionId);
        }
        if (b.aksi === "aset.ubah") {
            const berubah = objek(d.berubah) ?? {};
            for (const ujung of ["dari", "ke"] as const) {
                tambah(ids.area, objek(berubah.areaId)?.[ujung]);
                tambah(ids.divisi, objek(berubah.divisionId)?.[ujung]);
                tambah(ids.tipe, objek(berubah.assetTypeId)?.[ujung]);
            }
        }
    }
    return ids;
}

/* ---------- pengelompokan per hari ---------- */

/** Kunci hari Jakarta "YYYY-MM-DD". */
export const kunciHari = (t: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(t);

/** "Hari ini", "Kemarin", atau "Senin, 16 November 2026". */
export function judulHari(kunci: string, hariIni: string): string {
    const tgl = new Date(`${kunci}T12:00:00+07:00`);
    const lengkap = formatTanggal(tgl, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (kunci === hariIni) return `Hari ini · ${lengkap}`;
    const kemarin = kunciHari(new Date(new Date(`${hariIni}T12:00:00+07:00`).getTime() - 86_400_000));
    if (kunci === kemarin) return `Kemarin · ${lengkap}`;
    return lengkap;
}

export function kelompokkanPerHari<T extends { createdAt: Date }>(rows: T[]): { hari: string; rows: T[] }[] {
    const hasil: { hari: string; rows: T[] }[] = [];
    for (const r of rows) {
        const k = kunciHari(r.createdAt);
        const akhir = hasil.at(-1);
        if (akhir?.hari === k) akhir.rows.push(r);
        else hasil.push({ hari: k, rows: [r] });
    }
    return hasil;
}

/** "14.05" WIB. */
export const jamMenit = (t: Date) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(t);

/* ---------- saringan ---------- */

const TGL = /^\d{4}-\d{2}-\d{2}$/;

export type SaringanAudit = { kategori?: KategoriAudit; pengguna?: number; dari?: string; sampai?: string };

/** Membaca saringan dari query string; nilai yang tidak sah diabaikan. */
export function saringanDari(sp: Record<string, string | string[] | undefined>): SaringanAudit {
    const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
    const kategori = s("kategori");
    const pengguna = s("pengguna");
    const dari = s("dari");
    const sampai = s("sampai");
    return {
        kategori: adalahKategori(kategori) ? kategori : undefined,
        pengguna: pengguna && ANGKA.test(pengguna) ? Number(pengguna) : undefined,
        dari: dari && TGL.test(dari) ? dari : undefined,
        sampai: sampai && TGL.test(sampai) ? sampai : undefined,
    };
}

/** Batas waktu [mulai, akhir) untuk rentang tanggal Jakarta (UTC+7, tanpa musim panas). */
export function rentangWaktu(f: Pick<SaringanAudit, "dari" | "sampai">): { mulai?: Date; akhir?: Date } {
    return {
        mulai: f.dari ? new Date(`${f.dari}T00:00:00+07:00`) : undefined,
        akhir: f.sampai ? new Date(new Date(`${f.sampai}T00:00:00+07:00`).getTime() + 86_400_000) : undefined,
    };
}
