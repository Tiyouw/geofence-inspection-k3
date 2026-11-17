/**
 * Perakit data laporan: fungsi MURNI dari baris basis data ke isi dokumen.
 * Kueri ada di queries.ts, tampilan di pdf/ dan app/pemantau. Diuji di __tests__/rakit.test.ts.
 *
 * Diterjemahkan dari LaporanController::rakit dan RingkasanDasbor (Laravel), dengan
 * dua celah SPEC §9 diperbaiki:
 *  - #8 "perlu tinjauan" = definisi antrean (final, gerbang ∈ GATE_PERLU_TINJAUAN, belum ditinjau);
 *  - #9 laporan periode lampau memuat aset aktif ATAU aset yang diinspeksi pada periode itu.
 */
import {
  GATE_PERLU_TINJAUAN,
  LABEL_KESIMPULAN,
  type AnswerType,
  type GateStatus,
  type IssueStatus,
  type Kesimpulan,
  type Severity,
} from "@/lib/domain/constants";
import { labelLantai } from "@/lib/domain/asset";
import { simbolJawaban, TINDAKAN_BAKU } from "@/lib/domain/jawaban";
import { bacaTipeKotak, butirIsiDari, kelengkapanP3k, nilaiIsi, type KondisiIsi } from "@/lib/domain/modul/p3k";
import { SIMBOL_KEDALUWARSA, SIMBOL_KURANG, SIMBOL_TIDAK_ADA } from "./profil";
import { NAMA_BULAN, tanggalIso } from "./format";

/* ---------- bahan (bentuk baris dari queries.ts) ---------- */

export type AsetLaporan = {
  id: number;
  kode: string;
  gedung: string | null;
  lantai: string | null;
  lokasiTeks: string;
  aktif: boolean;
  /** Atribut aset (tipe_kotak untuk P3K). */
  attributes?: Record<string, unknown> | null;
};

export type ButirLaporan = {
  id: number;
  label: string;
  dasarHukum: string | null;
  grupNama: string;
  grupUrut: number;
  urut: number;
  answerType: AnswerType;
  severityMap: Record<string, Severity> | null;
  severityDefault: Severity;
  jumlahBaku: number | null;
  jumlahBakuPerTipe?: Partial<Record<"A" | "B" | "C", number>> | null;
  hasExpiry?: boolean;
};

export type InspeksiLaporan = {
  id: string;
  assetId: number;
  inspectedAt: Date;
  kesimpulan: Kesimpulan | null;
  gateStatus: GateStatus;
  ditinjauPada: Date | null;
  petugas: string;
  jawaban: {
    checklistItemId: number;
    nilai: string | null;
    nilaiAngka: number | null;
    kondisiIsi?: KondisiIsi | null;
    tglKedaluwarsaTerdekat?: string | null;
  }[];
};

export type TemuanLaporan = {
  id: number;
  assetId: number;
  item: string;
  severity: Severity;
  status: IssueStatus;
  tindakLanjut: string | null;
  targetSelesai: string | null;
  createdAt: Date;
  selesaiPada: Date | null;
};

/* ---------- aturan kecil ---------- */

/** Antrean tinjauan admin (SPEC §3.5): dipakai juga oleh "perlu tinjauan" laporan (§9 #8). */
export function perluTinjauan(i: { gateStatus: GateStatus; ditinjauPada: Date | null }): boolean {
  return GATE_PERLU_TINJAUAN.includes(i.gateStatus) && i.ditinjauPada === null;
}

/** "Lorong Timur titik 1" + "(Lt. 1)" terpisah supaya PDF bisa mengecilkan lantainya. */
export function lokasiAset(a: Pick<AsetLaporan, "lokasiTeks" | "gedung" | "lantai">): { utama: string; lantai: string | null } {
  return { utama: a.lokasiTeks || a.gedung || "-", lantai: labelLantai(a.lantai) };
}

/** Asset::labelLokasi: "Lorong Timur titik 1 · Lt. 1". */
export function labelLokasi(a: Pick<AsetLaporan, "lokasiTeks" | "gedung" | "lantai">): string {
  const l = lokasiAset(a);
  return [l.utama, l.lantai].filter(Boolean).join(" · ");
}

/** Asset::labelMedia: "Dry Powder / 9 kg". */
export function labelMedia(attr: { tipe?: string; jenis?: string; kapasitas_kg?: number } | null | undefined): string | null {
  const jenis = attr?.jenis || attr?.tipe;
  const kapasitas = attr?.kapasitas_kg;
  if (!jenis && !kapasitas) return null;
  return `${jenis || "APAR"}${kapasitas ? ` / ${kapasitas} kg` : ""}`;
}

const URUT_TINGKAT: Record<Severity, number> = { berat: 0, sedang: 1, ringan: 2 };

/** Urutan biner seperti SQLite: null lebih dulu, lalu titik kode. */
function bandingTeks(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

export function urutAset<T extends Pick<AsetLaporan, "gedung" | "lantai" | "kode">>(aset: T[]): T[] {
  return [...aset].sort((a, b) => bandingTeks(a.gedung, b.gedung) || bandingTeks(a.lantai, b.lantai) || bandingTeks(a.kode, b.kode));
}

export function urutButir<T extends Pick<ButirLaporan, "grupUrut" | "urut">>(butir: T[]): T[] {
  return [...butir].sort((a, b) => a.grupUrut - b.grupUrut || a.urut - b.urut);
}

/** Temuan belum selesai: berat → sedang → ringan, lalu yang terlama. */
export function urutTemuan<T extends Pick<TemuanLaporan, "severity" | "createdAt" | "id">>(temuan: T[]): T[] {
  return [...temuan].sort(
    (a, b) => URUT_TINGKAT[a.severity] - URUT_TINGKAT[b.severity] || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
}

/** Satu inspeksi per aset: yang terakhir bila ada pemeriksaan ulang dalam periode (SPEC §4.9). */
export function inspeksiTerakhirPerAset<T extends { assetId: number; inspectedAt: Date }>(daftar: T[]): Map<number, T> {
  const out = new Map<number, T>();
  for (const i of [...daftar].sort((a, b) => a.inspectedAt.getTime() - b.inspectedAt.getTime())) out.set(i.assetId, i);
  return out;
}

const HARI = 86_400_000;

/** Issue::umurHari: hari penuh sejak ditemukan sampai selesai atau sekarang. */
export function umurHari(t: Pick<TemuanLaporan, "createdAt" | "selesaiPada">, now: Date): number {
  return Math.max(0, Math.floor(((t.selesaiPada ?? now).getTime() - t.createdAt.getTime()) / HARI));
}

/** Tenggat lewat: target_selesai sebelum hari ini (WIB), sama dengan tab "Lewat tenggat" dasbor. */
export function lewatTenggat(t: Pick<TemuanLaporan, "targetSelesai">, hariIni: string): boolean {
  return t.targetSelesai !== null && t.targetSelesai < hariIni;
}

/* ---------- Lembar PMS dan ringkasan periode ---------- */

export type BarisPms = {
  aset: AsetLaporan;
  lokasi: { utama: string; lantai: string | null };
  inspeksi: InspeksiLaporan | null;
  simbol: string[];
  kesimpulan: string;
  /** Kotak P3K: kelengkapan isi (%), null bila belum diperiksa; undefined untuk modul lain. */
  kelengkapan?: number | null;
};

export type RingkasPeriode = {
  total: number;
  diperiksa: number;
  belum: number;
  kepatuhan: number;
  layak: number;
  layakCatatan: number;
  tidakLayak: number;
  beratTerbuka: number;
  perluTinjauan: number;
};

export type DataPeriode = {
  butir: ButirLaporan[];
  grup: { nama: string; jumlah: number }[];
  baris: BarisPms[];
  temuan: TemuanLaporan[];
  ringkas: RingkasPeriode;
};

/** Tanggal WIB "YYYY-MM-DD" dari waktu inspeksi: acuan kedaluwarsa isi P3K. */
function tanggalWib(t: Date): string {
  return new Date(t.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Sel lembar PMS untuk modul tertentu. Isi kotak P3K: jumlah, ditambah ↓ bila kurang dari baku
 * tipe kotak dan K bila ada yang kedaluwarsa. Pilihan "Tidak ada" (siamese pilar): TA.
 */
function simbolSel(
  b: ButirLaporan,
  j: InspeksiLaporan["jawaban"][number] | undefined,
  p3k: { tipeKotak: "A" | "B" | "C"; hariIni: string } | null,
): string {
  if (p3k && b.answerType === "number" && b.jumlahBakuPerTipe) {
    if (j?.nilaiAngka == null) return "-";
    const [isi] = butirIsiDari([b]);
    const n = nilaiIsi(isi!, j, p3k);
    return `${n.jumlah}${n.kosong || n.kurang > 0 ? SIMBOL_KURANG : ""}${n.kedaluwarsa ? SIMBOL_KEDALUWARSA : ""}`;
  }
  if (b.answerType === "select" && j?.nilai === "Tidak ada" && !b.severityMap?.["Tidak ada"]) return SIMBOL_TIDAK_ADA;
  return simbolJawaban(b, j);
}

export function rakitPeriode(input: {
  aset: AsetLaporan[];
  butir: ButirLaporan[];
  inspeksi: InspeksiLaporan[];
  temuan: TemuanLaporan[];
  /** Slug tipe aset; "p3k" menambah penilaian isi dan kelengkapan. */
  slug?: string;
}): DataPeriode {
  const isP3k = input.slug === "p3k";
  const terakhir = inspeksiTerakhirPerAset(input.inspeksi);
  // §9 #9: aset nonaktif tetap muncul di periode yang sempat ia diinspeksi.
  const aset = urutAset(input.aset.filter((a) => a.aktif || terakhir.has(a.id)));
  const idAset = new Set(aset.map((a) => a.id));
  const butir = urutButir(input.butir);

  const grup: { nama: string; jumlah: number }[] = [];
  for (const b of butir) {
    const akhir = grup.at(-1);
    if (akhir && akhir.nama === b.grupNama) akhir.jumlah++;
    else grup.push({ nama: b.grupNama, jumlah: 1 });
  }

  const baris = aset.map((a): BarisPms => {
    const ins = terakhir.get(a.id) ?? null;
    const jawaban = new Map(ins?.jawaban.map((j) => [j.checklistItemId, j]));
    const p3k = isP3k && ins ? { tipeKotak: bacaTipeKotak(a.attributes) ?? ("A" as const), hariIni: tanggalWib(ins.inspectedAt) } : null;
    return {
      aset: a,
      lokasi: lokasiAset(a),
      inspeksi: ins,
      simbol: butir.map((b) => (ins ? simbolSel(b, jawaban.get(b.id), p3k) : "-")),
      kesimpulan: ins ? (ins.kesimpulan ? LABEL_KESIMPULAN[ins.kesimpulan] : "-") : "Belum diperiksa",
      ...(isP3k
        ? {
            kelengkapan: p3k
              ? kelengkapanP3k(
                  butirIsiDari(butir),
                  ins!.jawaban,
                  p3k,
                ).persen
              : null,
          }
        : {}),
    };
  });

  const temuan = urutTemuan(input.temuan.filter((t) => t.status !== "selesai" && idAset.has(t.assetId)));
  const periksa = baris.flatMap((b) => (b.inspeksi ? [b.inspeksi] : []));
  const total = aset.length;
  const diperiksa = periksa.length;
  const hitung = (k: Kesimpulan) => periksa.filter((i) => i.kesimpulan === k).length;

  return {
    butir,
    grup,
    baris,
    temuan,
    ringkas: {
      total,
      diperiksa,
      belum: Math.max(total - diperiksa, 0),
      kepatuhan: total > 0 ? Math.round((diperiksa / total) * 1000) / 10 : 0,
      layak: hitung("layak"),
      layakCatatan: hitung("layak_catatan"),
      tidakLayak: hitung("tidak_layak"),
      beratTerbuka: temuan.filter((t) => t.severity === "berat").length,
      perluTinjauan: periksa.filter(perluTinjauan).length,
    },
  };
}

/* ---------- Rekap temuan ---------- */

export type BarisRekap = {
  no: number;
  temuan: TemuanLaporan;
  aset: AsetLaporan | undefined;
  lokasi: { utama: string; lantai: string | null };
  tindakan: string;
  lewat: boolean;
  umur: number;
};

export function rakitRekap(data: DataPeriode, now: Date) {
  const hariIni = tanggalIso(now);
  const asetById = new Map(data.baris.map((b) => [b.aset.id, b.aset]));
  const baris = data.temuan.map((t, i): BarisRekap => {
    const aset = asetById.get(t.assetId);
    return {
      no: i + 1,
      temuan: t,
      aset,
      lokasi: aset ? lokasiAset(aset) : { utama: "-", lantai: null },
      tindakan: t.tindakLanjut || TINDAKAN_BAKU[t.severity],
      lewat: lewatTenggat(t, hariIni),
      umur: umurHari(t, now),
    };
  });
  return {
    baris,
    ringkas: {
      terbuka: baris.length,
      berat: baris.filter((b) => b.temuan.severity === "berat").length,
      lewat: baris.filter((b) => b.lewat).length,
      unitTerdampak: new Set(baris.map((b) => b.temuan.assetId)).size,
      totalUnit: data.ringkas.total,
    },
  };
}

/* ---------- Kartu kontrol ---------- */

export type InspeksiKartu = Pick<InspeksiLaporan, "inspectedAt" | "kesimpulan" | "gateStatus" | "ditinjauPada" | "petugas"> & {
  jumlahTemuan: number;
};

export type BarisKartu = {
  bulan: string;
  inspeksi: InspeksiKartu | null;
  /** isi = ada inspeksi; terlewat = bulan sudah lewat tanpa inspeksi; mendatang = belum datang. */
  keadaan: "isi" | "terlewat" | "mendatang";
  tinjau: boolean;
};

export function rakitKartu(tahun: number, inspeksi: InspeksiKartu[], now: Date): BarisKartu[] {
  const hariIni = tanggalIso(now);
  const perBulan = new Map<number, InspeksiKartu>();
  for (const i of [...inspeksi].sort((a, b) => a.inspectedAt.getTime() - b.inspectedAt.getTime())) {
    const iso = tanggalIso(i.inspectedAt);
    if (Number(iso.slice(0, 4)) === tahun) perBulan.set(Number(iso.slice(5, 7)), i);
  }
  return NAMA_BULAN.map((bulan, idx) => {
    const ins = perBulan.get(idx + 1) ?? null;
    // Akhir bulan sudah lewat bila hari ini berada di bulan sesudahnya.
    const akhirBulan = `${tahun}-${String(idx + 1).padStart(2, "0")}-31`;
    const lewat = hariIni.slice(0, 7) > akhirBulan.slice(0, 7);
    return { bulan, inspeksi: ins, keadaan: ins ? "isi" : lewat ? "terlewat" : "mendatang", tinjau: ins ? perluTinjauan(ins) : false };
  });
}

/* ---------- Ringkasan pemantau (SPEC §5) ---------- */

export type AngkaPantau = {
  total: number;
  diperiksa: number;
  persen: number;
  tidakLayak: number;
  berat: number;
  lewat: number;
  posisi: number;
  hari: number;
};

/** RingkasanDasbor::narasi, tiga keadaan (ACCEPTANCE J2). */
export function narasiPemantau(d: AngkaPantau, persenTeks: (n: number) => string): string {
  if (d.total === 0) return "Belum ada APAR aktif. Ringkasan akan terisi setelah aset dan inspeksi tersedia.";
  if (d.diperiksa === 0) {
    return `Belum ada inspeksi bulan ini. ${d.total} APAR aktif menunggu pemeriksaan sebelum akhir bulan (sisa ${d.hari} hari).`;
  }
  return (
    `${d.diperiksa} dari ${d.total} APAR sudah diperiksa bulan ini (${persenTeks(d.persen)}%). ${d.tidakLayak} unit dinyatakan tidak layak pakai. ` +
    `Ada ${d.berat} temuan berat dan ${d.lewat} temuan lewat tenggat yang belum selesai, ` +
    `serta ${d.posisi} inspeksi yang menunggu tinjauan posisi.`
  );
}

export type TandaRisiko = "Berat" | "Lewat tenggat" | "Perlu perhatian";

/**
 * Risiko terbuka (RingkasanDasbor::risiko, ACCEPTANCE J3): belum selesai, berat dulu,
 * lalu tenggat terdekat, tanpa tenggat paling akhir.
 */
export function urutRisiko<T extends Pick<TemuanLaporan, "id" | "severity" | "targetSelesai" | "status">>(
  temuan: T[],
  hariIni: string,
  batas = 5,
): (T & { tanda: TandaRisiko[] })[] {
  return temuan
    .filter((t) => t.status !== "selesai")
    .sort(
      (a, b) =>
        Number(a.severity !== "berat") - Number(b.severity !== "berat") ||
        Number(a.targetSelesai === null) - Number(b.targetSelesai === null) ||
        (a.targetSelesai ?? "").localeCompare(b.targetSelesai ?? "") ||
        a.id - b.id,
    )
    .slice(0, batas)
    .map((t) => {
      const tanda: TandaRisiko[] = [];
      if (t.severity === "berat") tanda.push("Berat");
      if (lewatTenggat(t, hariIni)) tanda.push("Lewat tenggat");
      else if (t.severity !== "berat") tanda.push("Perlu perhatian");
      return { ...t, tanda };
    });
}

/** Sisa hari bulan ini, seperti ceil(now→endOfMonth) di Laravel. */
export function sisaHariBulan(now: Date): number {
  const iso = tanggalIso(now);
  const [y, m] = iso.split("-").map(Number) as [number, number];
  // Awal bulan berikutnya pukul 00:00 WIB = 17:00 UTC hari sebelumnya.
  const akhir = Date.UTC(y, m, 1) - 7 * 3_600_000;
  return Math.max(0, Math.ceil((akhir - now.getTime()) / HARI));
}
