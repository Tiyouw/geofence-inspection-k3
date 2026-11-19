import { describe, expect, it } from "vitest";
import {
    bacaPeristiwa,
    bolehBerlangganan,
    pesanUntukSasaran,
    peristiwaDariAudit,
    saluranUntuk,
    terdampak,
} from "../saluran";

describe("saluran realtime", () => {
    it("staf mendengar saluran staf dan saluran pribadinya saja", () => {
        expect(saluranUntuk({ id: 3, role: "pemantau", divisionId: 7 })).toEqual(["palk3:staf", "palk3:pengguna:3"]);
    });

    it("inspektur hanya saluran inspektur, unitnya, dan dirinya", () => {
        const u = { id: 9, role: "inspektur" as const, divisionId: 2 };
        expect(saluranUntuk(u)).toEqual(["palk3:inspektur", "palk3:unit:2", "palk3:pengguna:9"]);
        expect(bolehBerlangganan(u, "palk3:staf")).toBe(false);
        expect(bolehBerlangganan(u, "palk3:unit:3")).toBe(false);
        expect(bolehBerlangganan(u, "palk3:pengguna:10")).toBe(false);
        expect(bolehBerlangganan({ ...u, divisionId: null }, "palk3:unit:2")).toBe(false);
    });

    it("id hanya dikirim ke staf; saluran inspektur/unit/pengguna hanya jenisnya", () => {
        const m = pesanUntukSasaran({ t: "inspeksi", id: "abc" }, { staf: true, unit: 4, pengguna: [5, 5, null] });
        expect(m).toEqual([
            { saluran: "palk3:staf", data: { t: "inspeksi", id: "abc" } },
            { saluran: "palk3:unit:4", data: { t: "inspeksi" } },
            { saluran: "palk3:pengguna:5", data: { t: "inspeksi" } },
        ]);
    });

    it("aksi audit dipetakan ke peristiwa; melihat token tidak", () => {
        expect(peristiwaDariAudit("aset.lihat_token", "1")).toBeNull();
        expect(peristiwaDariAudit("masuk", "1")).toBeNull();
        expect(peristiwaDariAudit("inspeksi.tinjau", "u")).toEqual({
            p: { t: "tinjauan", id: "u" },
            s: { staf: true },
        });
        expect(peristiwaDariAudit("area.setujui", "4")?.s).toEqual({ staf: true, inspektur: true });
        expect(peristiwaDariAudit("pengguna.nonaktifkan", "12")?.s).toEqual({ staf: true, pengguna: [12] });
        expect(peristiwaDariAudit("tipe.ubah_periode", "2")?.p.t).toBe("jadwal");
    });

    it("halaman terdampak dan pembacaan pesan", () => {
        expect(terdampak("pengguna", "/admin/pengguna")).toBe(true);
        expect(terdampak("pengguna", "/pemantau")).toBe(false);
        expect(terdampak("tinjauan", "/pemantau/tinjauan")).toBe(true);
        expect(bacaPeristiwa('{"t":"aset","id":"3"}')).toEqual({ t: "aset", id: "3" });
        expect(bacaPeristiwa({ t: "lain" })).toBeNull();
        expect(bacaPeristiwa("bukan json")).toBeNull();
    });
});

describe("peristiwa masukan panduan", () => {
    it("tanda selesai masukan hanya ke saluran staf dan menyegarkan halaman admin saja", async () => {
        const { peristiwaDariAudit, terdampak } = await import("../saluran");
        expect(peristiwaDariAudit("masukan.selesai", "abc")).toEqual({ p: { t: "masukan", id: "abc" }, s: { staf: true } });
        expect(terdampak("masukan", "/admin/masukan")).toBe(true);
        expect(terdampak("masukan", "/pemantau")).toBe(false);
    });
});
