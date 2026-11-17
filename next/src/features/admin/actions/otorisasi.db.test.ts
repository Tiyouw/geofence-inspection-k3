/**
 * Uji integrasi otorisasi Server Action admin terhadap Postgres uji (B5, B9, K5, K6, G11).
 * Memanggil aksi LANGSUNG, seperti penyerang yang melewati UI. Dilewati bila DATABASE_URL tidak ada
 * (job "check" CI tanpa Postgres); jalankan lokal setelah `pnpm db:migrate && pnpm db:seed`.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

type Pengguna = {
    id: number;
    name: string;
    nip: string;
    role: "admin" | "pemantau" | "inspektur";
    jabatan: null;
    divisionId: null;
};
const sesi: { user: Pengguna | null } = { user: null };

vi.mock("@/lib/auth/guards", () => {
    class AksesDitolak extends Error {
        constructor(public readonly status: 401 | 403) {
            super(String(status));
        }
    }
    return {
        AksesDitolak,
        getCurrentUser: async () => sesi.user,
        assertRole: async (...roles: string[]) => {
            if (!sesi.user) throw new AksesDitolak(401);
            if (!roles.includes(sesi.user.role)) throw new AksesDitolak(403);
            return sesi.user;
        },
    };
});

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("otorisasi aksi admin (integrasi)", async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { sql, eq } = await import("drizzle-orm");
    const aset = await import("./aset");
    const insp = await import("./inspeksi");
    const temuan = await import("./temuan");
    const peng = await import("./pengguna");
    const jadwal = await import("./jadwal");
    const { cari } = await import("./pencarian");
    const { cariPanel } = await import("../server/pencarian");
    const { ringkasanDasbor, antreanDasbor } = await import("../server/dasbor");

    const akun: Record<string, Pengguna> = {};
    let asetId = 0;
    let issueId = 0;
    let inspeksiId = "";

    beforeAll(async () => {
        for (const nip of ["admin", "pemantau", "inspektur"]) {
            const [u] = await db.select().from(s.users).where(eq(s.users.nip, nip));
            akun[nip] = { id: u!.id, name: u!.name, nip, role: u!.role, jabatan: null, divisionId: null };
        }
        const [a] = await db.select({ id: s.assets.id }).from(s.assets).limit(1);
        asetId = a!.id;
        const [t] = await db
            .insert(s.issues)
            .values({ assetId: asetId, item: "Uji otorisasi", severity: "ringan" })
            .returning({ id: s.issues.id });
        issueId = t!.id;
        const [i] = await db
            .insert(s.inspections)
            .values({
                assetId: asetId,
                userId: akun.inspektur!.id,
                status: "final",
                gateStatus: "jauh",
                inspectedAt: new Date(),
                jarakM: 500,
            })
            .returning({ id: s.inspections.id });
        inspeksiId = i!.id;
    });

    afterAll(async () => {
        await db.delete(s.issues).where(eq(s.issues.id, issueId));
        await db.delete(s.inspections).where(eq(s.inspections.id, inspeksiId));
    });

    const fd = (o: Record<string, string>) => {
        const f = new FormData();
        for (const [k, v] of Object.entries(o)) f.set(k, v);
        return f;
    };

    /** Aksi tulis data induk dan tinjauan; `tanpaTinjau` untuk Pemantau, yang boleh meninjau (ADR-9). */
    const semuaAksi = (tanpaTinjau = false) => [
        () =>
            aset.buatAset(
                null,
                fd({ assetTypeId: "1", kode: "X-OTORISASI", lokasiTeks: "x", lokasiTipe: "dalam_gedung" }),
            ),
        () =>
            aset.ubahAset(
                asetId,
                null,
                fd({ assetTypeId: "1", kode: "X", lokasiTeks: "x", lokasiTipe: "dalam_gedung" }),
            ),
        () => aset.gantiTokenAset(asetId),
        () => aset.lihatTokenAset(asetId),
        ...(tanpaTinjau ? [] : [() => insp.tandaiDitinjau(null, fd({ id: inspeksiId, catatanReview: "Alasan cukup panjang" }))]),
        () => insp.simpanCatatanReview(null, fd({ id: inspeksiId, catatanReview: "x" })),
        () => temuan.tetapkanTenggat(null, fd({ id: String(issueId), targetSelesai: "2099-01-01" })),
        () => temuan.ubahStatusTemuan(null, fd({ id: String(issueId), ke: "selesai", uraian: "Uraian cukup panjang" })),
        () => temuan.tetapkanPic(null, fd({ id: String(issueId), picUserId: "" })),
        () => temuan.buatTemuan(null, fd({ assetId: String(asetId), item: "x", severity: "berat" })),
        () => peng.buatPengguna(null, fd({ nip: "x-otorisasi", name: "x", role: "admin", password: "sandi-panjang" })),
        () => peng.ubahPengguna(akun.admin!.id, null, fd({ nip: "admin", name: "x", role: "inspektur", aktif: "on" })),
        () => peng.aturAktifPengguna(akun.admin!.id, false),
        () => peng.terbitkanSandi(akun.admin!.id),
        () => jadwal.ubahPeriodeTipe(null, fd({ id: "1", periodeHari: "1" })),
    ];

    for (const [peran, status] of [
        ["pemantau", 403],
        ["inspektur", 403],
        [null, 401],
    ] as const) {
        it(`${peran ?? "tamu"} ditolak ${status} di semua aksi tulis dan tidak ada yang berubah (B5)`, async () => {
            sesi.user = peran ? akun[peran]! : null;
            const sebelum = await db.execute(sql`select
        (select count(*) from audit_logs)::int a, (select count(*) from issue_events)::int e,
        (select qr_token from assets where id = ${asetId}) t, (select status from issues where id = ${issueId}) s,
        (select ditinjau_pada from inspections where id = ${inspeksiId}) d`);
            for (const aksi of semuaAksi(peran === "pemantau")) {
                const r = await aksi();
                expect(r.ok).toBe(false);
                expect(r.ok === false && r.status).toBe(status);
            }
            const sesudah = await db.execute(sql`select
        (select count(*) from audit_logs)::int a, (select count(*) from issue_events)::int e,
        (select qr_token from assets where id = ${asetId}) t, (select status from issues where id = ${issueId}) s,
        (select ditinjau_pada from inspections where id = ${inspeksiId}) d`);
            expect(sesudah.rows).toEqual(sebelum.rows);
        });
    }

    it("admin tidak bisa mengubah peran atau menonaktifkan dirinya sendiri (B9)", async () => {
        sesi.user = akun.admin!;
        const r1 = await peng.aturAktifPengguna(akun.admin!.id, false);
        expect(r1.ok === false && r1.status).toBe(403);
        const r2 = await peng.ubahPengguna(
            akun.admin!.id,
            null,
            fd({ nip: "admin", name: "Administrator Demo", role: "pemantau", aktif: "on" }),
        );
        expect(r2.ok === false && r2.status).toBe(403);
        const [u] = await db
            .select({ role: s.users.role, aktif: s.users.aktif })
            .from(s.users)
            .where(eq(s.users.id, akun.admin!.id));
        expect(u).toEqual({ role: "admin", aktif: true });
    });

    it("pemantau meninjau; peninjau pertama tercatat, admin lalu 409; GPS tidak berubah (H6, ADR-9)", async () => {
        sesi.user = akun.pemantau!;
        const r = await insp.tandaiDitinjau(null, fd({ id: inspeksiId, catatanReview: "Diverifikasi lewat CCTV." }));
        expect(r.ok).toBe(true);
        sesi.user = akun.admin!;
        const ulang = await insp.tandaiDitinjau(
            null,
            fd({ id: inspeksiId, catatanReview: "Diverifikasi lewat CCTV." }),
        );
        expect(ulang.ok === false && ulang.status).toBe(409);
        const [i] = await db.select().from(s.inspections).where(eq(s.inspections.id, inspeksiId));
        expect(i).toMatchObject({ jarakM: 500, gateStatus: "jauh", ditinjauOleh: akun.pemantau!.id });
    });

    it("pemantau tidak boleh mengubah catatan tinjauan sesudahnya (hanya admin)", async () => {
        sesi.user = akun.pemantau!;
        const r = await insp.simpanCatatanReview(null, fd({ id: inspeksiId, catatanReview: "ubah" }));
        expect(r.ok === false && r.status).toBe(403);
    });

    it("transisi temuan yang tidak sah ditolak (H9)", async () => {
        sesi.user = akun.admin!;
        const r = await temuan.ubahStatusTemuan(null, fd({ id: String(issueId), ke: "terbuka" }));
        expect(r.ok === false && r.status).toBe(409);
    });

    it("pencarian: inspektur kosong; pemantau tanpa aset/tindakan; tidak mengembalikan token (K5, K6)", async () => {
        sesi.user = akun.inspektur!;
        expect(await cari("01")).toEqual([]);
        const pemantau = await cariPanel("01", "pemantau");
        expect(pemantau.map((g) => g.nama)).not.toContain("Aset");
        expect(pemantau.map((g) => g.nama)).not.toContain("Tindakan");
        const [{ qr_token }] = (await db.execute(sql`select qr_token from assets limit 1`)).rows as {
            qr_token: string;
        }[];
        const admin = await cariPanel(qr_token, "admin");
        expect(admin.flatMap((g) => g.hasil)).toEqual([]);
        expect(JSON.stringify(await cariPanel("01", "admin"))).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
        expect(await cariPanel("%%", "admin")).toEqual([]);
    });

    it("membuka dasbor tidak menulis jadwal (G11)", async () => {
        const hitung = async () =>
            ((await db.execute(sql`select count(*)::int n from schedules`)).rows[0] as { n: number }).n;
        const sebelum = await hitung();
        await ringkasanDasbor();
        for (const t of ["berat", "lewat", "posisi", "belum"] as const) await antreanDasbor(t, 1);
        expect(await hitung()).toBe(sebelum);
    });
});
