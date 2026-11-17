/**
 * Validasi masukan aksi admin (zod), dengan pesan berbahasa Indonesia (ACCEPTANCE M3).
 * Masukan formulir datang sebagai string; kosong berarti null.
 */
import { z } from "zod";
import { LOKASI_TIPE, ROLES } from "@/lib/domain/constants";

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const teks = (label: string, maks: number) =>
    z.preprocess(
        (v) => (typeof v === "string" ? v.trim() : v),
        z
            .string({ error: `${label} wajib diisi.` })
            .min(1, `${label} wajib diisi.`)
            .max(maks, `${label} maksimal ${maks} karakter.`),
    );
const teksOpsional = (label: string, maks: number) =>
    z
        .preprocess(
            (v) => kosongJadiNull(typeof v === "string" ? v.trim() : v),
            z.string().max(maks, `${label} maksimal ${maks} karakter.`).nullable().optional(),
        )
        .transform((v) => v ?? null);
const angkaOpsional = (label: string, min: number, maks: number, bulat = false) =>
    z
        .preprocess(
            (v) => {
                const k = kosongJadiNull(v);
                return typeof k === "string" ? Number(k.replace(",", ".")) : k;
            },
            z
                .number({ error: `${label} harus berupa angka.` })
                .min(min, `${label} minimal ${min}.`)
                .max(maks, `${label} maksimal ${maks}.`)
                .refine((n) => !bulat || Number.isInteger(n), `${label} harus bilangan bulat.`)
                .nullable()
                .optional(),
        )
        .transform((v) => v ?? null);
const idWajib = (label: string) =>
    z.coerce
        .number({ error: `${label} wajib dipilih.` })
        .int()
        .positive(`${label} wajib dipilih.`);
const idOpsional = z
    .preprocess(kosongJadiNull, z.coerce.number().int().positive().nullable().optional())
    .transform((v) => v ?? null);
const centang = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());
const tanggalOpsional = (label: string) =>
    z
        .preprocess(
            kosongJadiNull,
            z.iso
                .date({ error: `${label} bukan tanggal yang sah.` })
                .nullable()
                .optional(),
        )
        .transform((v) => v ?? null);

/** Formulir aset (SPEC §4.1). Token sengaja tidak ada: hanya bisa diganti lewat aksi "Ganti token". */
export const skemaAset = z
    .object({
        assetTypeId: idWajib("Tipe objek"),
        kode: teks("Nomor aset", 32),
        divisionId: idOpsional,
        aktif: centang,
        areaId: idOpsional,
        lantai: teksOpsional("Lantai", 16),
        lokasiTeks: teks("Uraian lokasi", 255),
        lat: angkaOpsional("Lintang", -90, 90),
        lng: angkaOpsional("Bujur", -180, 180),
        tglExpired: tanggalOpsional("Tanggal kedaluwarsa"),
        jenis: teksOpsional("Jenis media", 32),
        kapasitasKg: angkaOpsional("Kapasitas", 0, 1000),
    })
    .superRefine((v, ctx) => {
        if ((v.lat === null) !== (v.lng === null)) {
            ctx.addIssue({
                code: "custom",
                path: [v.lat === null ? "lat" : "lng"],
                message: "Lintang dan bujur diisi berpasangan.",
            });
        }
    });
export type MasukanAset = z.infer<typeof skemaAset>;

const sandi = z.string().min(8, "Kata sandi minimal 8 karakter.").max(128, "Kata sandi maksimal 128 karakter.");

/** Formulir petugas (SPEC §4.5). Sandi wajib saat buat; kosong saat ubah = dipertahankan. */
export const skemaPengguna = z.object({
    nip: z.preprocess(
        (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
        z
            .string({ error: "NIP wajib diisi." })
            .min(1, "NIP wajib diisi.")
            .max(32, "NIP maksimal 32 karakter.")
            .regex(/^[a-z0-9._-]+$/, "NIP hanya boleh huruf, angka, titik, garis bawah, atau tanda hubung."),
    ),
    name: teks("Nama", 120),
    email: z
        .preprocess(kosongJadiNull, z.email("Surel tidak sah.").max(190).nullable().optional())
        .transform((v) => (v ? v.toLowerCase() : null)),
    role: z.enum(ROLES, { error: "Peran wajib dipilih." }),
    divisionId: idOpsional,
    jabatan: teksOpsional("Jabatan", 120),
    aktif: centang,
    password: z.preprocess(kosongJadiNull, sandi.nullable().optional()).transform((v) => v ?? null),
});
export type MasukanPengguna = z.infer<typeof skemaPengguna>;

export const skemaPeriodeTipe = z.object({
    id: idWajib("Tipe objek"),
    periodeHari: z.coerce
        .number({ error: "Periode harus berupa angka." })
        .int("Periode harus bilangan bulat.")
        .min(1, "Periode minimal 1 hari.")
        .max(366, "Periode maksimal 366 hari."),
});

/** Ubah galat zod menjadi { kolom: [pesan] }. */
export function galatKolom(error: z.ZodError): Record<string, string[]> {
    const hasil: Record<string, string[]> = {};
    for (const issue of error.issues) {
        const k = String(issue.path[0] ?? "_");
        (hasil[k] ??= []).push(issue.message);
    }
    return hasil;
}
