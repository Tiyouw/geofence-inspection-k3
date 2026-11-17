/**
 * Aturan inspeksi yang murni: dipakai klien (umpan balik langsung, luring) dan
 * dijalankan ulang di peladen saat finalisasi (SPEC §7.1 butir 2).
 * Sumber: SPEC §3.3, §3.4, §3.7, §3.8, §3.9, §7.6.
 */
import {
  TENGGAT_HARI,
  type AnswerType,
  type Kesimpulan,
  type KondisiIsi,
  type Severity,
  type TipeKotakP3k,
  type TindakanRekomendasi,
} from "./constants";
import { periksaIsiP3k, temuanIsiP3k, butirIsiDari, type KonteksP3k } from "./modul/p3k";

export type ButirChecklist = {
  id: number;
  label: string;
  answerType: AnswerType;
  options: string[] | null;
  severityMap: Record<string, Severity> | null;
  severityDefault: Severity;
  jumlahBaku: number | null;
  satuan: string | null;
  wajib: boolean;
  /** Isi kotak P3K: baku per tipe kotak dan pencatatan kedaluwarsa. */
  jumlahBakuPerTipe?: Partial<Record<TipeKotakP3k, number>> | null;
  hasExpiry?: boolean;
  /** Tindakan bawaan bila butir menjadi temuan (PRD Temuan); kosong = menurut tingkat. */
  tindakanBawaan?: TindakanRekomendasi | null;
};

export type Jawaban = {
  checklistItemId: number;
  nilai?: string | null;
  nilaiAngka?: number | null;
  catatan?: string | null;
  /** Isi kotak P3K. */
  kondisiIsi?: KondisiIsi | null;
  tglKedaluwarsaTerdekat?: string | null;
};

const DUA_NILAI: AnswerType[] = ["fungsi", "kondisi", "boolean"];

/** SPEC §3.3: label pilihan dua-nilai. Nilai tersimpan "ok" / "tidak". */
export function labelDuaNilai(t: AnswerType): { ok: string; tidak: string } {
  if (t === "fungsi") return { ok: "Berfungsi", tidak: "Tidak berfungsi" };
  if (t === "boolean") return { ok: "Ada", tidak: "Tidak ada" };
  return { ok: "Baik", tidak: "Tidak baik" };
}

export function isDuaNilai(t: AnswerType): boolean {
  return DUA_NILAI.includes(t);
}

/** SPEC §3.3: validasi per tipe. Mengembalikan pesan galat atau null. */
export function validasiJawaban(item: ButirChecklist, j: Jawaban): string | null {
  const nilai = j.nilai ?? null;
  const angka = j.nilaiAngka ?? null;
  if (j.catatan && j.catatan.length > 500) return `Catatan "${item.label}" terlalu panjang.`;
  if (item.answerType === "number") {
    if (nilai !== null && nilai !== "") return `Isian "${item.label}" harus berupa angka.`;
    if (angka === null) return null;
    // Butir tanpa baku adalah catatan (mis. odometer mobil pemadam), boleh angka besar.
    const maks = item.jumlahBaku === null ? 9_999_999 : 100000;
    if (!Number.isInteger(angka) || angka < 0 || angka > maks) return `Angka "${item.label}" tidak sah.`;
    return null;
  }
  if (angka !== null) return `Isian "${item.label}" tidak menerima angka.`;
  if (nilai === null || nilai === "") return null;
  if (nilai.length > 120) return `Isian "${item.label}" terlalu panjang.`;
  if (isDuaNilai(item.answerType) && nilai !== "ok" && nilai !== "tidak") return `Pilihan "${item.label}" tidak sah.`;
  if (item.answerType === "select" && !(item.options ?? []).includes(nilai)) return `Pilihan "${item.label}" tidak sah.`;
  if (item.answerType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return `Tanggal "${item.label}" tidak sah.`;
  return null;
}

export function terjawab(item: ButirChecklist, j: Jawaban | undefined): boolean {
  if (!j) return false;
  if (item.answerType === "number") return j.nilaiAngka !== null && j.nilaiAngka !== undefined;
  return j.nilai !== null && j.nilai !== undefined && j.nilai !== "";
}

/** SPEC §3.4: tingkat temuan sebuah jawaban, atau null bila bukan temuan. */
export function severityJawaban(item: ButirChecklist, j: Jawaban | undefined): Severity | null {
  if (!j || !terjawab(item, j)) return null;
  switch (item.answerType) {
    case "number":
      return item.jumlahBaku !== null && (j.nilaiAngka ?? 0) < item.jumlahBaku ? item.severityDefault : null;
    case "text":
    case "date":
      return null;
    case "select":
      return item.severityMap?.[j.nilai!] ?? null;
    default:
      if (item.severityMap?.[j.nilai!]) return item.severityMap[j.nilai!]!;
      return j.nilai === "tidak" ? item.severityDefault : null;
  }
}

/** SPEC §3.8: kalimat temuan. */
export function kalimatTemuan(item: ButirChecklist, j: Jawaban): string {
  if (item.answerType === "select") return `${item.label}: ${j.nilai}`;
  if (item.answerType === "number") {
    const n = j.nilaiAngka ?? 0;
    const baku = item.jumlahBaku ?? 0;
    return `${item.label}: ${n} dari ${baku} ${item.satuan || "buah"}, kurang ${baku - n}`;
  }
  return `${item.label}: ${labelDuaNilai(item.answerType).tidak}`;
}

export const TINDAKAN_BAKU: Record<Severity, string> = {
  berat: "Tabung diturunkan dari layanan, diganti unit cadangan",
  sedang: "Dijadwalkan perbaikan dalam tenggat yang ditetapkan",
  ringan: "Dibenahi pada kunjungan berikutnya",
};

export type Temuan = { checklistItemId: number; item: string; severity: Severity; tindakan: TindakanRekomendasi };

/** Tindakan bawaan bila butir tidak menyebutnya: berat → ganti, lainnya → perbaiki ({{Assumption}}). */
export function tindakanBawaan(item: Pick<ButirChecklist, "tindakanBawaan">, severity: Severity): TindakanRekomendasi {
  return item.tindakanBawaan ?? (severity === "berat" ? "ganti" : "perbaiki");
}

const URUT_SEVERITY: Record<Severity, number> = { berat: 0, sedang: 1, ringan: 2 };

/**
 * Temuan dari seluruh jawaban, diurutkan berat → sedang → ringan. Untuk kotak P3K, `p3k`
 * menambahkan temuan isi (jumlah, kosong, kedaluwarsa) dari lib/domain/modul/p3k.
 */
export function bangunTemuan(items: ButirChecklist[], jawaban: Jawaban[], p3k?: KonteksP3k | null): Temuan[] {
  const map = new Map(jawaban.map((j) => [j.checklistItemId, j]));
  const out: Temuan[] = [];
  for (const item of items) {
    const j = map.get(item.id);
    const sev = severityJawaban(item, j);
    if (sev) out.push({ checklistItemId: item.id, item: kalimatTemuan(item, j!), severity: sev, tindakan: tindakanBawaan(item, sev) });
  }
  if (p3k) {
    for (const t of temuanIsiP3k(butirIsiDari(items), jawaban, p3k)) {
      out.push({ checklistItemId: t.checklistItemId, item: t.item, severity: t.severity, tindakan: t.tindakan });
    }
  }
  return out.sort((a, b) => URUT_SEVERITY[a.severity] - URUT_SEVERITY[b.severity]);
}

/** SPEC §3.4: tanpa temuan → layak; ada berat → tidak_layak; selain itu → layak_catatan. */
export function usulanKesimpulan(temuan: { severity: Severity }[]): Kesimpulan {
  if (temuan.length === 0) return "layak";
  if (temuan.some((t) => t.severity === "berat")) return "tidak_layak";
  return "layak_catatan";
}

export type DataKirim = {
  jawaban: Jawaban[];
  jumlahFoto: number;
  /**
   * Hasil periksaFotoLangkah (kamera terpandu). Bila diisi, menggantikan pemeriksaan jumlah
   * foto per inspeksi, karena syaratnya per langkah dan area terbatas tanpa foto.
   */
  galatFoto?: string[];
  kesimpulan: Kesimpulan | null | undefined;
  catatan?: string | null;
  rekomendasi?: string | null;
  /** Konteks kotak P3K (tipe kotak, tanggal); null untuk modul lain. */
  p3k?: KonteksP3k | null;
};

/**
 * SPEC §3.7: pemeriksaan sebelum kirim, urutan sama dengan peladen lama.
 * Mengembalikan daftar pesan; kosong berarti boleh dikirim.
 */
export function periksaKirim(items: ButirChecklist[], data: DataKirim, maksFoto: number): string[] {
  const map = new Map(data.jawaban.map((j) => [j.checklistItemId, j]));
  const galat: string[] = [];
  for (const j of data.jawaban) {
    const item = items.find((i) => i.id === j.checklistItemId);
    if (!item) {
      galat.push("Ada jawaban untuk butir yang tidak dikenal.");
      continue;
    }
    const g = validasiJawaban(item, j);
    if (g) galat.push(g);
  }
  const belum = items.filter((i) => i.wajib && !terjawab(i, map.get(i.id))).map((i) => i.label);
  if (belum.length) galat.push(`Masih ada pemeriksaan yang belum diisi: ${belum.join(", ")}`);
  if (data.p3k) galat.push(...periksaIsiP3k(items, data.jawaban, data.p3k));
  if (data.galatFoto) galat.push(...data.galatFoto);
  else {
    if (data.jumlahFoto < 1) galat.push("Foto wajib diunggah minimal satu sebelum inspeksi dikirim.");
    if (data.jumlahFoto > maksFoto) galat.push(`Foto paling banyak ${maksFoto}.`);
  }
  if (!data.kesimpulan) galat.push("Kesimpulan wajib dipilih.");
  if ((data.catatan?.length ?? 0) > 1000) galat.push("Catatan paling panjang 1000 karakter.");
  if ((data.rekomendasi?.length ?? 0) > 1000) galat.push("Rekomendasi paling panjang 1000 karakter.");
  const usulan = usulanKesimpulan(bangunTemuan(items, data.jawaban, data.p3k));
  if (usulan === "tidak_layak" && data.kesimpulan === "layak") {
    galat.push("Terdapat temuan berat, kesimpulan tidak dapat diisi Layak pakai.");
  }
  if (usulan !== "layak" && !(data.rekomendasi ?? "").trim()) {
    galat.push("Ada temuan pada inspeksi ini, rekomendasi wajib diisi.");
  }
  return galat;
}

/* ---------- waktu (SPEC §7.6) ---------- */

const MENIT = 60_000;
const HARI = 86_400_000;

/**
 * Waktu resmi inspeksi.
 * - Daring (selisih terkoreksi < 2 menit): waktu terima peladen.
 * - Antrean: waktu kirim perangkat + offset jam, dibatasi [terima − 7 hari, terima].
 */
export function waktuResmi(input: {
  receivedAt: Date;
  submittedAtDevice: Date | null;
  offsetMs: number;
}): { inspectedAt: Date; offline: boolean; clockSkewS: number } {
  const clockSkewS = Math.round(-input.offsetMs / 1000) || 0;
  if (!input.submittedAtDevice) return { inspectedAt: input.receivedAt, offline: false, clockSkewS };
  const terkoreksi = input.submittedAtDevice.getTime() + input.offsetMs;
  const terima = input.receivedAt.getTime();
  if (Math.abs(terima - terkoreksi) < 2 * MENIT) return { inspectedAt: input.receivedAt, offline: false, clockSkewS };
  const t = Math.min(terima, Math.max(terima - 7 * HARI, terkoreksi));
  return { inspectedAt: new Date(t), offline: true, clockSkewS };
}

/* ---------- jadwal (SPEC §3.9, §9 #19) ---------- */

/** "YYYY-MM-DD" → "YYYY-MM-01" */
export function periodeDari(tanggal: string): string {
  return tanggal.slice(0, 8) + "01";
}

/** jatuh_tempo = min(periode + periode_hari − 1, akhir bulan). */
export function jatuhTempo(periode: string, periodeHari: number): string {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periode.slice(0, 8)}${String(Math.min(Math.max(periodeHari, 1), akhir)).padStart(2, "0")}`;
}

/** Tanggal (YYYY-MM-DD) + n hari. */
export function tambahHari(tanggal: string, n: number): string {
  const d = new Date(tanggal + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tenggat temuan: tanggal inspeksi + n hari menurut tingkat. */
export function tenggatTemuan(tanggalInspeksi: string, severity: Severity): string {
  return tambahHari(tanggalInspeksi, TENGGAT_HARI[severity]);
}

/* ---------- pesan gerbang (SPEC §3.5) ---------- */

export function pesanGerbang(status: string, jarak: number | null, radius: number | null): string {
  switch (status) {
    case "sesuai":
      return "Lokasi sesuai.";
    case "perlu_review":
      return `Anda berjarak ${jarak} m dari titik aset (batas ${radius} m). Inspeksi tetap dapat dikirim dan akan ditinjau Admin K3.`;
    case "jauh":
      return `Anda berjarak ${jarak} m dari titik aset, jauh di luar batas ${radius} m. Pastikan stiker yang dipindai benar.`;
    case "gps_lemah":
      return "Sinyal GPS lemah, posisi tidak dapat dipastikan. Ini tidak dihitung sebagai pelanggaran.";
    case "tidak_berlaku":
      return "Objek bergerak, pemeriksaan lokasi tidak diberlakukan.";
    default:
      return "Lokasi tidak terdeteksi. Inspeksi tetap dapat dikirim.";
  }
}

export const LABEL_GERBANG: Record<string, string> = {
  sesuai: "Lokasi sesuai",
  perlu_review: "Perlu ditinjau",
  jauh: "Jauh dari aset",
  gps_lemah: "GPS lemah",
  tidak_berlaku: "Objek bergerak",
  tanpa_gps: "Tanpa GPS",
};

/** Ambil token dari URL stiker atau token mentah (segmen terakhir URL). SPEC §3.1. */
export function ambilToken(teks: string): string | null {
  const t = teks.trim();
  if (!t) return null;
  let kandidat = t;
  try {
    const u = new URL(t);
    kandidat = u.pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    // bukan URL: pakai apa adanya
  }
  return normalisasiKodeCadangan(kandidat);
}

/**
 * Kode cadangan yang diketik dari stiker. Token tercetak kecil dan terpotong ke beberapa baris
 * (dan sejak perbaikan ini dikelompokkan per 4 karakter), sehingga ketikan petugas bisa memuat
 * spasi, baris baru, tanda hubung panjang dari papan ketik ponsel, huruf besar, atau tanpa awalan.
 * Huruf O/I/L tidak ada di heksadesimal, jadi dibaca sebagai 0/1 (salah baca stiker yang pudar).
 */
export function normalisasiKodeCadangan(teks: string): string | null {
  let s = teks
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .toLowerCase();
  s = s.replace(/^pal-?k3-?/, "");
  s = s.replace(/-/g, "").replace(/o/g, "0").replace(/[il]/g, "1");
  return /^[0-9a-f]{32}$/.test(s) ? "PAL-K3-" + s : null;
}

/** Mirip nomor aset ("01D", "14A"), bukan token: petugas mengetik nomor besar di stiker. */
export function miripNomorAset(teks: string): boolean {
  return /^[a-z0-9][a-z0-9.\-/]{0,11}$/i.test(teks.trim()) && !normalisasiKodeCadangan(teks);
}
