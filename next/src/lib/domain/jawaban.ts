/**
 * Penilaian satu jawaban checklist, murni (SPEC §3.4 dan §4.9).
 * Diterjemahkan dari app/Models/InspectionAnswer.php dan ChecklistItem.php.
 */
import type { AnswerType, Severity } from "./constants";
import { severityJawaban as severityInspeksi } from "./inspeksi";

export type ButirPenilaian = {
  answerType: AnswerType;
  severityMap?: Record<string, Severity> | null;
  severityDefault?: Severity | null;
  jumlahBaku?: number | null;
};

export type NilaiJawaban = { nilai?: string | null; nilaiAngka?: number | null };

/**
 * Tingkat temuan, atau null bila jawaban ini bukan temuan (SPEC §3.4). Satu sumber
 * aturan: diteruskan ke severityJawaban milik lib/domain/inspeksi.ts (sesi Inspektur).
 */
export function severityJawaban(butir: ButirPenilaian, j: NilaiJawaban | null | undefined): Severity | null {
  return severityInspeksi(
    {
      id: 0,
      label: "",
      options: null,
      satuan: null,
      wajib: true,
      answerType: butir.answerType,
      severityMap: butir.severityMap ?? null,
      severityDefault: butir.severityDefault ?? "sedang",
      jumlahBaku: butir.jumlahBaku ?? null,
    },
    j ? { checklistItemId: 0, nilai: j.nilai, nilaiAngka: j.nilaiAngka } : undefined,
  );
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

/** Tindakan baku per tingkat (IssueGenerator::TINDAKAN), satu sumber di inspeksi.ts. */
export { TINDAKAN_BAKU } from "./inspeksi";
