/**
 * Modul Kotak P3K (Divisi Matra & K3LH), murni tanpa DB.
 * Sumber: PRD "Checklist per modul" tab Kotak P3K; Permenakertrans PER.15/MEN/VIII/2008
 * Pasal 10 dan Lampiran II. Seluruh checklist, tingkat, tindakan bawaan, dan periode 30 hari
 * adalah {{Assumption}} sampai formulir asli perusahaan diterima (PRD pertanyaan 3.1).
 * Angka baku disalin dari Lampiran II {{Unverified}}: perlu dicocokkan dengan cetakan resmi.
 */
import { KONDISI_ISI, SEGERA_KEDALUWARSA_HARI, type KondisiIsi, type Severity, type TindakanRekomendasi } from "../constants";
import type { DefinisiButir, DefinisiModul, TipeKotak } from "./tipe";

export { KONDISI_ISI, type KondisiIsi };
export const LABEL_KONDISI_ISI: Record<KondisiIsi, string> = {
  aman: "Aman",
  kedaluwarsa: "Ada yang kedaluwarsa",
};


const PS10 = "Permenakertrans PER.15/MEN/VIII/2008 Pasal 10";
const LAMP2 = "Permenakertrans PER.15/MEN/VIII/2008 Lampiran II";

/** [label, A, B, C, bertanda bintang] untuk butir 4-24, urutan Lampiran II. */
const ISI: [string, number, number, number, boolean][] = [
  ["Kasa steril terbungkus", 20, 40, 40, true],
  ["Perban (lebar 5 cm)", 2, 4, 6, false],
  ["Perban (lebar 10 cm)", 2, 4, 6, false],
  ["Plester (lebar 1,25 cm)", 2, 4, 6, true],
  ["Plester cepat", 10, 15, 20, true],
  ["Kapas (25 gram)", 1, 2, 3, false],
  ["Kain segitiga/mitela", 2, 4, 6, false],
  ["Gunting", 1, 1, 1, false],
  ["Peniti", 12, 12, 12, false],
  ["Sarung tangan sekali pakai (pasangan)", 2, 3, 4, true],
  ["Masker", 2, 4, 6, false],
  ["Pinset", 1, 1, 1, false],
  ["Lampu senter", 1, 1, 1, false],
  ["Gelas untuk cuci mata", 1, 1, 1, false],
  ["Kantong plastik bersih", 1, 2, 3, false],
  ["Aquades (100 ml larutan saline)", 1, 1, 1, true],
  ["Povidon iodin (60 ml)", 1, 1, 1, true],
  ["Alkohol 70%", 1, 1, 1, true],
  ["Buku panduan P3K di tempat kerja", 1, 1, 1, false],
  ["Buku catatan", 1, 1, 1, false],
  ["Daftar isi kotak", 1, 1, 1, false],
];

const butirIsi: DefinisiButir[] = ISI.map(([label, a, b, c, bintang], i) => ({
  urut: i + 4,
  label,
  answerType: "number",
  severityDefault: "sedang",
  dasarHukum: LAMP2,
  tindakan: "lengkapi",
  baku: { A: a, B: b, C: c },
  adaKedaluwarsa: bintang,
  satuan: "buah",
}));

export const DEFINISI_P3K: DefinisiModul = {
  slug: "p3k",
  nama: "Kotak P3K",
  pemilik: { kode: "MATRA", nama: "Divisi Matra & K3LH" },
  periodeHari: 30,
  isMobile: false,
  urut: 4,
  grup: [
    {
      kode: "A",
      nama: "Kotak dan penempatan",
      butir: [
        {
          urut: 1,
          label: "Kotak kuat, mudah dibawa, berwarna dasar putih dengan lambang P3K hijau",
          answerType: "kondisi",
          severityDefault: "ringan",
          dasarHukum: `${PS10} huruf a`,
          tindakan: "ganti",
        },
        {
          urut: 2,
          label: "Mudah dilihat dan dijangkau, ada tanda arah, cukup cahaya, mudah diangkat",
          answerType: "kondisi",
          severityDefault: "sedang",
          dasarHukum: `${PS10} huruf c angka 1`,
          tindakan: "perbaiki",
        },
        {
          urut: 3,
          label: "Tidak berisi bahan atau alat selain untuk P3K",
          answerType: "kondisi",
          severityDefault: "ringan",
          dasarHukum: `${PS10} huruf b`,
          tindakan: "perbaiki",
        },
      ],
    },
    { kode: "B", nama: "Isi kotak", butir: butirIsi },
  ],
  langkahFoto: [
    { kode: "kotak", judul: "Kotak tertutup dan penempatan", petunjuk: "Seluruh kotak, lambang P3K, dan tanda arah terlihat.", butir: [1, 2, 3] },
    { kode: "isi", judul: "Isi kotak P3K terbuka", petunjuk: "Buka kotak, semua isi terlihat dalam satu atau beberapa jepretan.", butir: butirIsi.map((b) => b.urut) },
    {
      kode: "kedaluwarsa",
      judul: "Tanggal kedaluwarsa terdekat",
      petunjuk: "Dekatkan kamera ke tanggal kedaluwarsa pada kemasan, boleh beberapa jepretan.",
      butir: butirIsi.filter((b) => b.adaKedaluwarsa).map((b) => b.urut),
    },
  ],
};

/* ---------- penilaian isi kotak ---------- */

/** Butir isi P3K seperti dibaca dari DB (jumlah_baku jsonb per tipe kotak). */
export type ButirIsiP3k = {
  id: number;
  label: string;
  jumlahBaku: Partial<Record<TipeKotak, number>> | number | null;
  hasExpiry: boolean;
  satuan?: string | null;
  severityDefault?: Severity;
};

export type JawabanIsiP3k = {
  checklistItemId: number;
  nilaiAngka?: number | null;
  kondisiIsi?: KondisiIsi | null;
  tglKedaluwarsaTerdekat?: string | null;
};

/** Konteks penilaian: tipe kotak aset (atribut tipe_kotak) dan tanggal inspeksi WIB. */
export type KonteksP3k = { tipeKotak: TipeKotak; hariIni: string };

export function bakuIsi(butir: Pick<ButirIsiP3k, "jumlahBaku">, tipeKotak: TipeKotak): number | null {
  const b = butir.jumlahBaku;
  if (b == null) return null;
  if (typeof b === "number") return b;
  return b[tipeKotak] ?? null;
}

export function bacaTipeKotak(attributes: Record<string, unknown> | null | undefined): TipeKotak | null {
  const t = String(attributes?.tipe_kotak ?? "").trim().toUpperCase();
  return t === "A" || t === "B" || t === "C" ? t : null;
}

/** Butir angka dengan baku: isi kotak P3K (bukan butir lain bertipe angka seperti odometer). */
export function isButirIsi(butir: { answerType: string; jumlahBaku: unknown }): boolean {
  return butir.answerType === "number" && butir.jumlahBaku != null;
}

function selisihHari(dari: string, ke: string): number {
  return Math.round((Date.parse(`${ke}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000);
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** "2026-11-05" → "5 Nov 2026" (tanggal kalender, tanpa zona waktu). */
export function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export type NilaiIsi = {
  baku: number | null;
  jumlah: number | null;
  kurang: number;
  kosong: boolean;
  kedaluwarsa: boolean;
  /** Tanggal kedaluwarsa terdekat ≤ 30 hari lagi dan belum lewat. */
  segeraKedaluwarsa: boolean;
  sisaHari: number | null;
  /** Jumlah ≥ baku dan tidak ada yang kedaluwarsa. */
  memenuhi: boolean;
};

export function nilaiIsi(butir: ButirIsiP3k, j: JawabanIsiP3k | undefined, ctx: KonteksP3k): NilaiIsi {
  const baku = bakuIsi(butir, ctx.tipeKotak);
  const jumlah = j?.nilaiAngka ?? null;
  const kosong = jumlah === 0;
  const kurang = baku !== null && jumlah !== null ? Math.max(0, baku - jumlah) : 0;
  const tgl = !kosong && butir.hasExpiry ? (j?.tglKedaluwarsaTerdekat ?? null) : null;
  const sisaHari = tgl ? selisihHari(ctx.hariIni, tgl) : null;
  const kedaluwarsa = !kosong && (j?.kondisiIsi === "kedaluwarsa" || (sisaHari !== null && sisaHari < 0));
  const segeraKedaluwarsa = !kedaluwarsa && sisaHari !== null && sisaHari <= SEGERA_KEDALUWARSA_HARI;
  return {
    baku,
    jumlah,
    kurang,
    kosong,
    kedaluwarsa,
    segeraKedaluwarsa,
    sisaHari,
    memenuhi: jumlah !== null && kurang === 0 && !kosong && !kedaluwarsa,
  };
}

/** Validasi isian satu butir isi. Mengembalikan pesan galat atau null. */
export function validasiIsi(butir: ButirIsiP3k, j: JawabanIsiP3k | undefined, ctx: KonteksP3k): string | null {
  const jumlah = j?.nilaiAngka ?? null;
  if (jumlah === null) return `Jumlah "${butir.label}" belum diisi.`;
  if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > 1000) return `Jumlah "${butir.label}" tidak sah.`;
  if (jumlah === 0) return null;
  if (!j?.kondisiIsi) return `Kondisi "${butir.label}" belum dipilih.`;
  if (!KONDISI_ISI.includes(j.kondisiIsi)) return `Kondisi "${butir.label}" tidak sah.`;
  const tgl = j.tglKedaluwarsaTerdekat ?? null;
  if (butir.hasExpiry) {
    if (!tgl) return `Tanggal kedaluwarsa terdekat "${butir.label}" belum diisi.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl) || Number.isNaN(Date.parse(tgl))) return `Tanggal kedaluwarsa "${butir.label}" tidak sah.`;
    if (j.kondisiIsi === "aman" && tgl < ctx.hariIni) {
      return `Tanggal kedaluwarsa "${butir.label}" sudah lewat. Pilih "${LABEL_KONDISI_ISI.kedaluwarsa}".`;
    }
  } else if (tgl) {
    return `"${butir.label}" tidak mencatat tanggal kedaluwarsa.`;
  }
  return null;
}

export type TemuanIsi = { checklistItemId: number; item: string; severity: Severity; tindakan: TindakanRekomendasi };

/** Kalimat temuan isi, mis. "Plester cepat: 6 dari 10 buah, kurang 4; ada yang kedaluwarsa (terdekat 5 Nov 2026)". */
export function kalimatTemuanIsi(butir: ButirIsiP3k, n: NilaiIsi, tgl: string | null): string | null {
  const bagian: string[] = [];
  const satuan = butir.satuan || "buah";
  if (n.kosong) bagian.push(`kosong (baku ${n.baku ?? 0} ${satuan})`);
  else if (n.kurang > 0) bagian.push(`${n.jumlah} dari ${n.baku} ${satuan}, kurang ${n.kurang}`);
  if (n.kedaluwarsa) bagian.push(tgl ? `ada yang kedaluwarsa (terdekat ${tanggalPendek(tgl)})` : "ada yang kedaluwarsa");
  return bagian.length ? `${butir.label}: ${bagian.join("; ")}` : null;
}

/**
 * PRD aturan temuan isi: jumlah kurang dari baku, jumlah 0, atau ada yang kedaluwarsa
 * → satu temuan sedang per butir {{Assumption}}. Tindakan: Lengkapi bila jumlah kurang,
 * Ganti bila hanya kedaluwarsa. Butir tanpa jawaban dilewati (ditolak oleh validasi).
 */
export function temuanIsiP3k(items: ButirIsiP3k[], jawaban: JawabanIsiP3k[], ctx: KonteksP3k): TemuanIsi[] {
  const map = new Map(jawaban.map((j) => [j.checklistItemId, j]));
  const out: TemuanIsi[] = [];
  for (const butir of items) {
    const j = map.get(butir.id);
    if (j?.nilaiAngka == null) continue;
    const n = nilaiIsi(butir, j, ctx);
    const item = kalimatTemuanIsi(butir, n, j.tglKedaluwarsaTerdekat ?? null);
    if (!item) continue;
    out.push({
      checklistItemId: butir.id,
      item,
      severity: butir.severityDefault ?? "sedang",
      tindakan: n.kosong || n.kurang > 0 ? "lengkapi" : "ganti",
    });
  }
  return out;
}

export type CatatanSegera = { checklistItemId: number; label: string; tanggal: string; sisaHari: number };

/** Isi dengan tanggal kedaluwarsa terdekat ≤ 30 hari lagi: catatan, bukan temuan. */
export function segeraKedaluwarsa(items: ButirIsiP3k[], jawaban: JawabanIsiP3k[], ctx: KonteksP3k): CatatanSegera[] {
  const map = new Map(jawaban.map((j) => [j.checklistItemId, j]));
  const out: CatatanSegera[] = [];
  for (const butir of items) {
    const j = map.get(butir.id);
    const n = nilaiIsi(butir, j, ctx);
    if (n.segeraKedaluwarsa) out.push({ checklistItemId: butir.id, label: butir.label, tanggal: j!.tglKedaluwarsaTerdekat!, sisaHari: n.sisaHari! });
  }
  return out.sort((a, b) => a.sisaHari - b.sisaHari);
}

export type Kelengkapan = { memenuhi: number; total: number; persen: number };

/**
 * Kelengkapan kotak: persentase butir isi yang memenuhi (jumlah ≥ baku dan tidak kedaluwarsa)
 * dari seluruh butir isi, dibulatkan ke bawah {{Assumption}}. Butir tanpa jawaban dihitung tidak memenuhi.
 */
export function kelengkapanP3k(items: ButirIsiP3k[], jawaban: JawabanIsiP3k[], ctx: KonteksP3k): Kelengkapan {
  const map = new Map(jawaban.map((j) => [j.checklistItemId, j]));
  const total = items.length;
  const memenuhi = items.filter((b) => nilaiIsi(b, map.get(b.id), ctx).memenuhi).length;
  return { memenuhi, total, persen: total ? Math.floor((memenuhi / total) * 100) : 0 };
}

/** Kedaluwarsa terdekat di seluruh isi kotak (untuk rekap isi P3K), atau null. */
export function kedaluwarsaTerdekat(items: ButirIsiP3k[], jawaban: JawabanIsiP3k[]): { label: string; tanggal: string } | null {
  const map = new Map(jawaban.map((j) => [j.checklistItemId, j]));
  let hasil: { label: string; tanggal: string } | null = null;
  for (const b of items) {
    const j = map.get(b.id);
    const t = b.hasExpiry && j?.nilaiAngka ? j.tglKedaluwarsaTerdekat : null;
    if (t && (!hasil || t < hasil.tanggal)) hasil = { label: b.label, tanggal: t };
  }
  return hasil;
}
