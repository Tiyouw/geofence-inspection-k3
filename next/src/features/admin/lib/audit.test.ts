import { describe, expect, it } from "vitest";
import {
    AKSI_DIKENAL,
    idRujukan,
    judulHari,
    kalimatTeks,
    kategoriDari,
    kelompokkanPerHari,
    rentangWaktu,
    rujukanKosong,
    saringanDari,
    tanpaKoordinat,
    uraikan,
    type BarisAudit,
    type Rujukan,
} from "./audit";

const r: Rujukan = rujukanKosong();
r.area.set(7, { nama: "Gedung Bengkel Pipa", aktif: true });
r.area.set(8, { nama: "Gudang Lama", aktif: false });
r.aset.set(106, "APAR 01D");
r.aset.set(107, "APAR 02D");
r.inspeksi.set("0190a1b2-0000-7000-8000-000000000001", "APAR 01D");
r.pengguna.set(5, { nama: "Budi", nip: "1987" });
r.tipe.set(3, "Hydrant Pilar");
r.divisi.set(2, "SATPK");

let n = 0;
const baris = (aksi: string, p: Partial<BarisAudit> = {}): BarisAudit => ({
    id: ++n,
    aksi,
    entitas: null,
    entitasId: null,
    data: null,
    ip: "10.0.0.1",
    createdAt: new Date("2026-11-17T03:00:00Z"),
    userId: 1,
    oleh: "Administrator Demo",
    olehNip: "admin",
    ...p,
});
const kalimat = (b: BarisAudit) => kalimatTeks(uraikan(b, r));

describe("uraikan: kalimat sehari-hari", () => {
    it("memasangkan aset ke area, dengan nama aset dan area", () => {
        expect(kalimat(baris("area.pasang_aset", { entitas: "area", entitasId: "7", data: { assetIds: [106] } }))).toBe(
            "Administrator Demo memasangkan 1 aset (APAR 01D) ke Gedung Bengkel Pipa",
        );
    });

    it("melepas aset bila area '-', dan meringkas daftar panjang", () => {
        const u = uraikan(
            baris("area.pasang_aset", { entitas: "area", entitasId: "-", data: { assetIds: [106, 107, 1, 2, 3] } }),
            r,
        );
        expect(kalimatTeks(u)).toBe(
            "Administrator Demo melepas 5 aset (APAR 01D, APAR 02D, aset #1 (sudah dihapus), dan 2 lainnya) dari areanya",
        );
        expect(u.ikon).toBe("lepas");
    });

    it("menyetujui poligon; area yang hilang atau nonaktif ditandai sudah dihapus", () => {
        expect(kalimat(baris("area.setujui", { entitas: "area", entitasId: "7" }))).toBe(
            "Administrator Demo menyetujui poligon Gedung Bengkel Pipa",
        );
        expect(kalimat(baris("area.setujui", { entitas: "area", entitasId: "240" }))).toBe(
            "Administrator Demo menyetujui poligon area #240 (sudah dihapus)",
        );
        expect(kalimat(baris("area.draf", { entitas: "area", entitasId: "8" }))).toBe(
            "Administrator Demo menyimpan draf poligon Gudang Lama (sudah dihapus)",
        );
    });

    it("mengubah nama area: kalimat ganti nama dan tabel sebelum → sesudah", () => {
        const u = uraikan(
            baris("area.ubah", {
                entitas: "area",
                entitasId: "7",
                data: {
                    dari: {
                        nama: "Gedung tanpa nama 050",
                        kode: "G050",
                        jenis: "gedung",
                        divisionId: null,
                        restricted: false,
                    },
                    ke: {
                        nama: "Gedung Bengkel Pipa",
                        kode: "G050",
                        jenis: "bengkel",
                        divisionId: 2,
                        restricted: false,
                    },
                },
            }),
            r,
        );
        expect(kalimatTeks(u)).toBe(
            "Administrator Demo mengubah nama “Gedung tanpa nama 050” menjadi “Gedung Bengkel Pipa”, juga mengubah jenis dan divisi",
        );
        expect(u.detail).toEqual([
            { bidang: "Nama", dari: "Gedung tanpa nama 050", ke: "Gedung Bengkel Pipa" },
            { bidang: "Jenis", dari: "Gedung", ke: "Bengkel" },
            { bidang: "Divisi", dari: "(tanpa divisi)", ke: "SATPK" },
        ]);
    });

    it("menyimpan area tanpa perubahan", () => {
        const sama = { nama: "X", kode: "X", jenis: "gedung", divisionId: null, restricted: false };
        expect(kalimat(baris("area.ubah", { entitas: "area", entitasId: "7", data: { dari: sama, ke: sama } }))).toBe(
            "Administrator Demo menyimpan area Gedung Bengkel Pipa tanpa perubahan",
        );
    });

    it("aset.ubah: tanda titikPeta (tanpa nilai) tetap terbaca sebagai titik di peta", () => {
        const u = uraikan(
            baris("aset.ubah", {
                entitas: "asset",
                entitasId: "106",
                data: { kode: "01D", berubah: { titikPeta: { dari: false, ke: true } } },
            }),
            r,
        );
        expect(kalimatTeks(u)).toBe("Administrator Demo mengubah titik di peta aset APAR 01D");
    });

    it("aset.ubah: nama area dan tipe diselesaikan; koordinat tidak pernah tampil", () => {
        const u = uraikan(
            baris("aset.ubah", {
                entitas: "asset",
                entitasId: "106",
                data: {
                    kode: "01D",
                    berubah: {
                        areaId: { dari: null, ke: 7 },
                        lat: { dari: "-7.20001", ke: "-7.20555" },
                        lng: { dari: "112.7311", ke: "112.7399" },
                        attributes: { dari: { jenis: "Powder" }, ke: { jenis: "CO2" } },
                    },
                },
            }),
            r,
        );
        expect(kalimatTeks(u)).toBe("Administrator Demo mengubah area, jenis isi, dan titik di peta aset APAR 01D");
        expect(u.detail).toContainEqual({ bidang: "Area", dari: "(tanpa area)", ke: "Gedung Bengkel Pipa" });
        expect(u.detail).toContainEqual({ bidang: "Jenis isi", dari: "Powder", ke: "CO2" });
        const semua = JSON.stringify(u);
        expect(semua).not.toMatch(/7\.20|112\.7/);
    });

    it("inspeksi ditolak lokasi: jarak tampil, koordinat tidak (juga di data teknis)", () => {
        const u = uraikan(
            baris("inspeksi.ditolak_lokasi", {
                entitas: "inspection",
                entitasId: "0190a1b2-0000-7000-8000-000000000002",
                data: {
                    assetId: 106,
                    lat: -7.2123,
                    lng: 112.7456,
                    akurasi: 12,
                    jarakKeKawasanM: 512.4,
                    jarakKeAreaM: 530,
                },
            }),
            r,
        );
        expect(kalimatTeks(u)).toBe(
            "Administrator Demo mencoba menginspeksi APAR 01D dari 512 m di luar kawasan, ditolak",
        );
        // Koordinat penolakan (AC-7) hanya di baris detail "Koordinat"; tidak di kalimat atau data teknis.
        expect(u.detail).toContainEqual({ bidang: "Koordinat", ke: "-7.212300, 112.745600" });
        expect(kalimatTeks(u)).not.toMatch(/7\.212|112\.745/);
        expect(u.teknis).toEqual({ assetId: 106, akurasi: 12, jarakKeKawasanM: 512.4, jarakKeAreaM: 530 });
    });

    it("inspeksi selesai dan ditinjau memakai label aset", () => {
        const id = "0190a1b2-0000-7000-8000-000000000001";
        expect(
            kalimat(
                baris("inspeksi.final", {
                    entitas: "inspection",
                    entitasId: id,
                    data: { gateStatus: "sesuai", offline: false },
                }),
            ),
        ).toBe("Administrator Demo menyelesaikan inspeksi APAR 01D (lokasi: lokasi sesuai)");
        expect(
            kalimat(baris("inspeksi.tinjau", { entitas: "inspection", entitasId: id, data: { hasil: "ditolak" } })),
        ).toBe("Administrator Demo menolak inspeksi APAR 01D");
    });

    it("pengguna, periode tipe, masuk, gagal masuk, dan cron", () => {
        expect(kalimat(baris("pengguna.nonaktifkan", { entitas: "user", entitasId: "5" }))).toBe(
            "Administrator Demo menonaktifkan akun Budi (NIP 1987)",
        );
        const ubah = uraikan(
            baris("pengguna.ubah", {
                entitas: "user",
                entitasId: "5",
                data: { nip: "1987", peran: { dari: "inspektur", ke: "pemantau" }, sandiDiganti: true },
            }),
            r,
        );
        expect(kalimatTeks(ubah)).toBe("Administrator Demo mengubah peran dan kata sandi Budi (NIP 1987)");
        expect(ubah.detail[0]).toEqual({ bidang: "Peran", dari: "Inspektur", ke: "Pemantau" });
        expect(
            kalimat(
                baris("tipe.ubah_periode", {
                    entitas: "asset_type",
                    entitasId: "3",
                    data: { slug: "hydrant_pilar", dari: 30, ke: 90 },
                }),
            ),
        ).toBe("Administrator Demo mengubah jadwal inspeksi Hydrant Pilar dari tiap 30 hari menjadi tiap 90 hari");
        expect(
            kalimat(baris("tipe.ubah_periode", { entitas: "asset_type", entitasId: "3", data: { dari: 30, ke: 30 } })),
        ).toBe("Administrator Demo menyimpan jadwal inspeksi Hydrant Pilar tanpa perubahan (tetap tiap 30 hari)");
        expect(kalimat(baris("masuk", { data: { nip: "admin" } }))).toBe("Administrator Demo masuk ke aplikasi");
        expect(kalimat(baris("masuk.gagal", { userId: null, oleh: null, olehNip: null, data: { nip: "admin" } }))).toBe(
            "Seseorang mencoba masuk dengan NIP admin tetapi gagal",
        );
        expect(
            kalimat(
                baris("cron.jadwal", {
                    userId: null,
                    oleh: null,
                    data: {
                        periode: "2026-11-01",
                        jadwalBaru: { "2026-11-01": 2, "2026-11-16": 3 },
                        terlewat: 1,
                        segera: 0,
                        ditautkan: 0,
                    },
                }),
            ),
        ).toBe("Sistem menyusun jadwal inspeksi periode November 2026: 5 jadwal baru, 1 terlewat");
    });

    it("aksi tak dikenal tetap terbaca, dengan kategori Lainnya", () => {
        const u = uraikan(baris("ekspor.pdf"), r);
        expect(kalimatTeks(u)).toBe("Administrator Demo melakukan aksi ekspor pdf");
        expect(u.kategori).toBe("lainnya");
    });

    it("setiap aksi yang ditulis kode punya kalimat", () => {
        for (const a of [
            "masuk",
            "masuk.gagal",
            "stiker.lihat",
            "area.setujui",
            "area.impor",
            "area.ubah",
            "area.hapus",
            "area.pasang_aset",
            "area.kawasan",
            "area.hapus_draf_massal",
            "area.draf",
            "area.buang_draf",
            "area.buat",
            "inspeksi.final",
            "inspeksi.ditolak_lokasi",
            "inspeksi.mode_demo",
            "inspeksi.tinjau",
            "pengguna.buat",
            "pengguna.ubah",
            "pengguna.aktifkan",
            "pengguna.nonaktifkan",
            "pengguna.terbitkan_sandi",
            "tipe.ubah_periode",
            "jadwal.rencana",
            "jadwal.batal_rencana",
            "aset.buat",
            "aset.ubah",
            "aset.ganti_token",
            "aset.lihat_token",
            "cron.jadwal",
        ]) {
            expect(AKSI_DIKENAL, a).toContain(a);
            expect(kategoriDari(a), a).not.toBe("lainnya");
        }
    });
});

describe("pembantu", () => {
    it("tanpaKoordinat membuang lat/lng/geometri di mana pun", () => {
        expect(tanpaKoordinat({ a: 1, lat: 2, nested: { lng: 3, geometry: {}, b: [{ latitude: 1, c: 2 }] } })).toEqual({
            a: 1,
            nested: { b: [{ c: 2 }] },
        });
    });

    it("idRujukan mengumpulkan id dari entitas dan data", () => {
        const ids = idRujukan([
            baris("area.pasang_aset", { entitas: "area", entitasId: "7", data: { assetIds: [106, 107] } }),
            baris("aset.ubah", {
                entitas: "asset",
                entitasId: "9",
                data: { berubah: { areaId: { dari: 8, ke: 7 }, divisionId: { dari: null, ke: 2 } } },
            }),
            baris("inspeksi.final", { entitas: "inspection", entitasId: "0190a1b2-0000-7000-8000-000000000001" }),
            baris("area.impor", { entitas: "area", entitasId: "-" }),
        ]);
        expect([...ids.area].sort()).toEqual([7, 8]);
        expect([...ids.aset].sort()).toEqual([106, 107, 9]);
        expect([...ids.divisi]).toEqual([2]);
        expect([...ids.inspeksi]).toHaveLength(1);
    });

    it("pengelompokan per hari memakai tanggal Jakarta", () => {
        const g = kelompokkanPerHari([
            { createdAt: new Date("2026-11-17T18:00:00Z") }, // 18 Nov 01.00 WIB
            { createdAt: new Date("2026-11-17T16:30:00Z") }, // 17 Nov 23.30 WIB
            { createdAt: new Date("2026-11-17T01:00:00Z") },
        ]);
        expect(g.map((x) => [x.hari, x.rows.length])).toEqual([
            ["2026-11-18", 1],
            ["2026-11-17", 2],
        ]);
        expect(judulHari("2026-11-18", "2026-11-18")).toMatch(/^Hari ini · Rabu, 18 November 2026$/);
        expect(judulHari("2026-11-17", "2026-11-18")).toMatch(/^Kemarin · /);
        expect(judulHari("2026-11-10", "2026-11-18")).toBe("Selasa, 10 November 2026");
    });

    it("saringan dari query string mengabaikan nilai tidak sah; rentang tanggal inklusif WIB", () => {
        expect(saringanDari({ kategori: "area", pengguna: "3", dari: "2026-11-01", sampai: "x" })).toEqual({
            kategori: "area",
            pengguna: 3,
            dari: "2026-11-01",
            sampai: undefined,
        });
        expect(saringanDari({ kategori: "hapus", pengguna: "1; drop" })).toEqual({
            kategori: undefined,
            pengguna: undefined,
            dari: undefined,
            sampai: undefined,
        });
        const { mulai, akhir } = rentangWaktu({ dari: "2026-11-17", sampai: "2026-11-17" });
        expect(mulai?.toISOString()).toBe("2026-11-16T17:00:00.000Z");
        expect(akhir?.toISOString()).toBe("2026-11-17T17:00:00.000Z");
    });
});
