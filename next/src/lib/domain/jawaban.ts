/**
 * Penilaian satu jawaban checklist, murni (SPEC §3.4 dan §4.9).
 * Diterjemahkan dari app/Models/InspectionAnswer.php dan ChecklistItem.php.
 */
import type { AnswerType, Severity } from "./constants";

export type ButirPenilaian = {
  answerType: AnswerType;
  severityMap?: Record<string, Severity> | null;
  severityDefault?: Severity | null;
  jumlahBaku?: number | null;
};

export type NilaiJawaban = { nilai?: string | null; nilaiAngka?: number | null };

/** ChecklistItem::severityUntukNilai: kunci severity_map, atau "tidak" untuk dua-nilai. */
function severityUntukNilai(butir: ButirPenilaian, nilai: string | null | undefined): Severity | null {
  if (nilai == null || nilai === "") return null;
  const map = butir.severityMap ?? {};
  if (Object.hasOwn(map, nilai)) return map[nilai]!;
  if (nilai === "tidak") return butir.severityDefault ?? "sedang";
  return null;
}

/**
 * Tingkat temuan, atau null bila jawaban ini bukan temuan (SPEC §3.4):
 * number < jumlah_baku → severity_default; text/date tidak pernah; select hanya
 * pilihan yang terdaftar di severity_map; dua-nilai bila "tidak".
 */
export function severityJawaban(butir: ButirPenilaian, j: NilaiJawaban): Severity | null {
  if (butir.answerType === "number") {
    const baku = butir.jumlahBaku;
    if (baku != null && j.nilaiAngka != null && j.nilaiAngka < baku) return butir.severityDefault ?? "sedang";
    return null;
  }
  if (butir.answerType === "text" || butir.answerType === "date") return null;
  return severityUntukNilai(butir, j.nilai);
}

export const SIMBOL = {
  fungsiOk: "✓",
  fungsiTidak: "X",
  kondisiOk: "O",
  kondisiTidak: "Ø",
  kosong: "-",
} as const;

/**
 * Simbol sel lembar PMS (InspectionAnswer::simbol). Dua dimensi tidak boleh
 * tertukar: ✓/X untuk fungsi, O/Ø untuk kondisi. Select dicetak O/Ø menurut
 * severity_map (teks pilihannya masuk temuan), number dicetak angkanya.
 */
export function simbolJawaban(butir: ButirPenilaian, j: NilaiJawaban | null | undefined): string {
  if (!j) return SIMBOL.kosong;
  switch (butir.answerType) {
    case "number":
      return j.nilaiAngka == null ? SIMBOL.kosong : String(j.nilaiAngka);
    case "fungsi":
      return j.nilai === "ok" ? SIMBOL.fungsiOk : SIMBOL.fungsiTidak;
    case "kondisi":
    case "boolean":
      return j.nilai === "ok" ? SIMBOL.kondisiOk : SIMBOL.kondisiTidak;
    case "select":
      return severityJawaban(butir, j) === null ? SIMBOL.kondisiOk : SIMBOL.kondisiTidak;
    default:
      return j.nilai ?? SIMBOL.kosong;
  }
}

/** Tindakan baku per tingkat, dicetak bila `tindak_lanjut` kosong (IssueGenerator::TINDAKAN). */
export const TINDAKAN_BAKU: Record<Severity, string> = {
  berat: "Tabung diturunkan dari layanan, diganti unit cadangan",
  sedang: "Dijadwalkan perbaikan dalam tenggat yang ditetapkan",
  ringan: "Dibenahi pada kunjungan berikutnya",
};
