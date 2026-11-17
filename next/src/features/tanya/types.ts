export type Bagian = { nomor: string; judul: string; ringkasan: string };

export type Pilihan = { kode: string; label: string };

export type Pertanyaan = {
    /** "1.2", sesuai penomoran catatan. */
    nomor: string;
    /** Nomor bagian, "1".."9". */
    bagian: string;
    wajib: boolean;
    teks: string;
    kenapa: string;
    /** Teks "Pilihan" apa adanya (bisa berupa petunjuk isian, bukan daftar). */
    pilihanTeks: string | null;
    /** Pilihan yang bisa diklik bila teks berbentuk "a) …; b) …". */
    pilihan: Pilihan[];
    /** "Kalau tidak dijawab, kami pakai". */
    bawaan: string;
    memblokir: string;
};

export type Lampiran = { id: string; nama: string; contentType: string; bytes: number };

export type JawabanSimpan = {
    jawaban: string;
    pilihan: string | null;
    pakaiBawaan: boolean;
    perluTanya: boolean;
};

export type JawabanAda = JawabanSimpan & { lampiran: Lampiran[]; diubahPada: string | null };
