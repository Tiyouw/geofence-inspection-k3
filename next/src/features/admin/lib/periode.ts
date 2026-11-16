/**
 * Batas periode (bulan kalender) di zona Asia/Jakarta. WIB tetap UTC+7 tanpa DST,
 * jadi batas bulan dapat dihitung tanpa pustaka zona waktu.
 */
const OFFSET_MS = 7 * 60 * 60 * 1000;

export type Periode = {
  tahun: number;
  /** 1..12 */
  bulan: number;
  /** Awal bulan (00.00 WIB) sebagai instan UTC. */
  awal: Date;
  /** Awal bulan berikutnya (eksklusif). */
  akhir: Date;
  /** YYYY-MM-01, nilai kolom schedules.periode. */
  tanggal: string;
};

export function periodeDari(tahun: number, bulan: number): Periode {
  const awal = new Date(Date.UTC(tahun, bulan - 1, 1) - OFFSET_MS);
  const akhir = new Date(Date.UTC(tahun, bulan, 1) - OFFSET_MS);
  return { tahun, bulan, awal, akhir, tanggal: `${tahun}-${String(bulan).padStart(2, "0")}-01` };
}

/** Periode berjalan menurut jam Jakarta. */
export function periodeJakarta(now: Date = new Date()): Periode {
  const wib = new Date(now.getTime() + OFFSET_MS);
  return periodeDari(wib.getUTCFullYear(), wib.getUTCMonth() + 1);
}

/** Periode n bulan sebelum p (n = 0 mengembalikan p). */
export function mundurBulan(p: Periode, n: number): Periode {
  const indeks = p.tahun * 12 + (p.bulan - 1) - n;
  return periodeDari(Math.floor(indeks / 12), (indeks % 12) + 1);
}

/** "Sisa n hari" menuju akhir bulan, dihitung dari tanggal Jakarta hari ini (hari ini tidak dihitung). */
export function sisaHariBulan(now: Date = new Date()): number {
  const p = periodeJakarta(now);
  const hariIni = new Date(now.getTime() + OFFSET_MS).getUTCDate();
  const jumlahHari = new Date(Date.UTC(p.tahun, p.bulan, 0)).getUTCDate();
  return jumlahHari - hariIni;
}

/** "2026-11" → periode; nilai tak sah → null. */
export function parsePeriode(nilai: string | null | undefined): Periode | null {
  const m = /^(\d{4})-(\d{2})$/.exec(nilai ?? "");
  if (!m) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  if (tahun < 2020 || tahun > 2100 || bulan < 1 || bulan > 12) return null;
  return periodeDari(tahun, bulan);
}

/** Tambah n hari ke tanggal YYYY-MM-DD. */
export function tambahHari(tanggal: string, n: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
