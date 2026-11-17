/**
 * Modul Hydrant (SAT. PK): dua tipe aset, hydrant_box (dalam gedung) dan hydrant_pilar
 * (halaman, dermaga, dok). Murni tanpa DB.
 * Sumber: PRD "Checklist per modul" tab Hydrant; Checklist Hydrant Faldy §1 (NFPA 25;
 * Permen PU 26/PRT/M/2008). Periode bulanan menurut "Panduan Ringkas Jadwal" formulir itu.
 * Rumah pompa, tangki, dan jaringan pipa di luar lingkup (keputusan pemilik).
 * Tingkat temuan dan tindakan bawaan {{Assumption}}. Inspeksi visual: tekanan air tidak diukur.
 */
import type { Severity } from "../constants";
import type { DefinisiButir, DefinisiModul } from "./tipe";

const SUMBER = "Checklist Hydrant §1";
export const PILIHAN_HYDRANT = ["Baik", "Rusak"] as const;
const SAT_PK = { kode: "SATPK", nama: "SAT. PK" };

function baikRusak(
  urut: number,
  label: string,
  keterangan: string,
  tingkat: Severity,
  dasarHukum: string,
  tindakan: DefinisiButir["tindakan"],
  tambahan: string[] = [],
): DefinisiButir {
  return {
    urut,
    label,
    answerType: "select",
    options: [...PILIHAN_HYDRANT, ...tambahan],
    severityMap: { Rusak: tingkat },
    severityDefault: tingkat,
    dasarHukum,
    keterangan,
    tindakan,
  };
}

export const DEFINISI_HYDRANT_BOX: DefinisiModul = {
  slug: "hydrant_box",
  nama: "Hydrant Box",
  pemilik: SAT_PK,
  periodeHari: 30,
  isMobile: false,
  urut: 2,
  grup: [
    {
      kode: "A",
      nama: "Pemeriksaan visual",
      butir: [
        baikRusak(
          1,
          "Akses dan visibilitas",
          "Tidak terhalang barang, rambu jelas, cat tidak pudar atau berkarat",
          "sedang",
          `${SUMBER} no. 1 (NFPA 25; Permen PU 26/PRT/M/2008)`,
          "perbaiki",
        ),
        baikRusak(2, "Fisik box dan kaca", "Pintu mudah dibuka, engsel berfungsi, kaca atau kunci utuh", "ringan", `${SUMBER} no. 2`, "perbaiki"),
        baikRusak(3, "Selang kebakaran", "Kering, tergulung rapi, tidak sobek atau getas, kopling utuh", "berat", `${SUMBER} no. 3`, "ganti"),
        baikRusak(4, "Nozzle dan hose rack", "Tersedia lengkap, seal karet baik, tuas tidak macet", "sedang", `${SUMBER} no. 4`, "lengkapi"),
        baikRusak(5, "Katup hydrant (valve)", "Tidak bocor, handwheel utuh", "berat", `${SUMBER} no. 5`, "perbaiki"),
      ],
    },
  ],
  langkahFoto: [
    { kode: "box", judul: "Box, kaca, dan akses", petunjuk: "Box tertutup beserta rambu dan jalan menuju box.", butir: [1, 2] },
    { kode: "selang", judul: "Selang, nozzle, dan rak", petunjuk: "Buka box, gulungan selang dan nozzle terlihat.", butir: [3, 4] },
    { kode: "katup", judul: "Katup hydrant", petunjuk: "Dekatkan kamera ke katup dan handwheel.", butir: [5] },
  ],
};

export const DEFINISI_HYDRANT_PILAR: DefinisiModul = {
  slug: "hydrant_pilar",
  nama: "Hydrant Pilar",
  pemilik: SAT_PK,
  periodeHari: 30,
  isMobile: false,
  urut: 3,
  grup: [
    {
      kode: "A",
      nama: "Pemeriksaan visual",
      butir: [
        baikRusak(
          1,
          "Akses dan visibilitas",
          "Tidak terhalang barang, kendaraan, atau material; rambu jelas; cat tidak pudar atau berkarat",
          "sedang",
          `${SUMBER} no. 1`,
          "perbaiki",
        ),
        baikRusak(2, "Katup dan pilar", "Tidak bocor, handwheel utuh, tutup outlet (cap) terpasang", "berat", `${SUMBER} no. 5`, "perbaiki"),
        baikRusak(
          3,
          "Siamese connection",
          'Mudah diakses pemadam, tutup kopling dan check valve baik. Pilih "Tidak ada" bila pilar tidak memilikinya.',
          "sedang",
          `${SUMBER} no. 6`,
          "perbaiki",
          ["Tidak ada"],
        ),
        baikRusak(
          4,
          "Korosi akibat lingkungan laut",
          "Tidak ada korosi yang merusak badan pilar atau outlet",
          "sedang",
          "Usulan khusus galangan (asumsi, belum ada dasar tertulis)",
          "perbaiki",
        ),
      ],
    },
  ],
  langkahFoto: [
    { kode: "pilar", judul: "Pilar dan akses", petunjuk: "Seluruh pilar, rambu, dan sekitarnya terlihat.", butir: [1, 4] },
    { kode: "katup", judul: "Katup dan tutup outlet", petunjuk: "Dekatkan kamera ke katup, handwheel, dan cap outlet.", butir: [2] },
    { kode: "siamese", judul: "Siamese connection", petunjuk: "Bila tidak ada, foto sisi pilar tempat seharusnya terpasang.", butir: [3] },
  ],
};
