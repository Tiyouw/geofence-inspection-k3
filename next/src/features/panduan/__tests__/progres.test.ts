import { describe, expect, it } from "vitest";
import { bacaProgres, hapusProgres, KUNCI_LAMA, KUNCI_PROGRES, tambahDilihat } from "../progres";

function penyimpanan(awal: Record<string, string> = {}) {
    const isi = new Map(Object.entries(awal));
    return {
        isi,
        getItem: (k: string) => isi.get(k) ?? null,
        setItem: (k: string, v: string) => void isi.set(k, v),
        removeItem: (k: string) => void isi.delete(k),
    };
}

const ID = ["sampul", "peran", "masuk", "selesai"];

describe("progres panduan", () => {
    it("pengunjung baru mulai tanpa centang", () => {
        expect(bacaProgres(penyimpanan(), ID)).toEqual([]);
    });

    it("membuang progres v1 yang tercentang semua", () => {
        const s = penyimpanan({ [KUNCI_LAMA]: JSON.stringify(ID) });
        expect(bacaProgres(s, ID)).toEqual([]);
        expect(s.isi.has(KUNCI_LAMA)).toBe(false);
    });

    it("menyimpan langkah yang dilihat dan mengabaikan id yang sudah tidak ada atau data rusak", () => {
        const s = penyimpanan();
        const d = tambahDilihat(s, tambahDilihat(s, [], "masuk"), "masuk");
        expect(d).toEqual(["masuk"]);
        s.setItem(KUNCI_PROGRES, JSON.stringify(["masuk", "langkah-lama"]));
        expect(bacaProgres(s, ID)).toEqual(["masuk"]);
        s.setItem(KUNCI_PROGRES, "{rusak");
        expect(bacaProgres(s, ID)).toEqual([]);
    });

    it("reset menghapus semua centang", () => {
        const s = penyimpanan({ [KUNCI_PROGRES]: JSON.stringify(ID), [KUNCI_LAMA]: "[]" });
        hapusProgres(s);
        expect(bacaProgres(s, ID)).toEqual([]);
        expect(s.isi.size).toBe(0);
    });
});
