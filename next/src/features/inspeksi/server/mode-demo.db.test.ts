/**
 * Mode demo pada finalisasi (src/lib/geo/mode-demo.ts): dari jauh di luar kawasan, akun demo
 * diterima sebagai perlu_tinjauan / mode_demo bila AKUN_DEMO_LEWATI_KAWASAN=1; akun sungguhan
 * tetap 422 di_luar_kawasan. Uji integrasi terhadap Postgres uji (butuh `pnpm db:seed` dengan
 * poligon kawasan contoh); dilewati bila DATABASE_URL tidak ada. Data yang dibuat dibersihkan.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// http.ts mengimpor guards (next-auth); finalisasi menerima SessionUser langsung.
vi.mock("@/lib/auth/guards", () => ({ AksesDitolak: class extends Error {}, assertRole: vi.fn() }));

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("finalisasi: mode demo di luar kawasan (integrasi)", async () => {
  const { and, asc, eq, inArray, notInArray } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { finalisasi, mulai } = await import("./inspeksi");
  const { ENV_MODE_DEMO } = await import("@/lib/geo/mode-demo");
  type SessionUser = import("@/lib/auth/guards").SessionUser;

  const envAwal = process.env[ENV_MODE_DEMO];
  const dibuat: string[] = [];
  const cadangan = new Map<number, { jadwal: (typeof s.schedules.$inferSelect)[]; terakhirDicek: string | null }>();

  afterEach(() => {
    if (envAwal === undefined) delete process.env[ENV_MODE_DEMO];
    else process.env[ENV_MODE_DEMO] = envAwal;
  });

  afterAll(async () => {
    if (dibuat.length) {
      await db.delete(s.issues).where(inArray(s.issues.inspectionId, dibuat));
      // Baris audit tidak dihapus: jejak audit hanya bisa ditambah (ADR-15); entitasId unik per uji.
      await db.delete(s.inspections).where(inArray(s.inspections.id, dibuat));
    }
    for (const [assetId, c] of cadangan) {
      // Finalisasi hanya meng-upsert (aset, periode): kembalikan baris lama, buang baris baru.
      const idLama = c.jadwal.map((j) => j.id);
      await db
        .delete(s.schedules)
        .where(and(eq(s.schedules.assetId, assetId), idLama.length ? notInArray(s.schedules.id, idLama) : undefined));
      for (const j of c.jadwal) {
        await db.update(s.schedules).set({ inspectionId: j.inspectionId, status: j.status }).where(eq(s.schedules.id, j.id));
      }
      await db.update(s.assets).set({ terakhirDicek: c.terakhirDicek }).where(eq(s.assets.id, assetId));
    }
  });

  async function penggunaInspektur(isDemo: boolean, divisionId: number): Promise<SessionUser | null> {
    const [u] = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.role, "inspektur"), eq(s.users.isDemo, isDemo), eq(s.users.divisionId, divisionId), eq(s.users.aktif, true)))
      .orderBy(asc(s.users.id))
      .limit(1);
    return u ? { id: u.id, name: u.name, nip: u.nip, role: u.role, jabatan: u.jabatan, divisionId: u.divisionId } : null;
  }

  /** Aset APAR milik unit akun demo, lengkap dengan titik jauh (≈ 55 km) di luar kawasan. */
  async function siapkan() {
    const [kawasan] = await db.select().from(s.areas).where(and(eq(s.areas.jenis, "kawasan"), eq(s.areas.aktif, true)));
    const [demo] = await db.select().from(s.users).where(and(eq(s.users.isDemo, true), eq(s.users.role, "inspektur")));
    if (!kawasan?.polygon || kawasan.polygon.type !== "Polygon" || !demo?.divisionId) return null;
    const [{ a: aset }] = await db
      .select({ a: s.assets })
      .from(s.assets)
      .innerJoin(s.assetTypes, eq(s.assetTypes.id, s.assets.assetTypeId))
      .where(and(eq(s.assetTypes.slug, "apar"), eq(s.assetTypes.ownerDivisionId, demo.divisionId), eq(s.assets.aktif, true)))
      .orderBy(asc(s.assets.id))
      .limit(1);
    if (!aset) return null;
    if (!cadangan.has(aset.id)) {
      cadangan.set(aset.id, {
        jadwal: await db.select().from(s.schedules).where(eq(s.schedules.assetId, aset.id)),
        terakhirDicek: aset.terakhirDicek,
      });
    }
    const [lng, lat] = kawasan.polygon.coordinates[0]![0]!;
    const butir = await db
      .select({ i: s.checklistItems })
      .from(s.checklistItems)
      .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
      .where(and(eq(s.checklistGroups.assetTypeId, aset.assetTypeId), eq(s.checklistItems.aktif, true)));
    const answers = butir.map(({ i }) => {
      if (i.answerType === "number") return { checklistItemId: i.id, nilaiAngka: i.jumlahBaku ?? 1 };
      if (i.answerType === "select") {
        const aman = (i.options ?? []).find((o) => !i.severityMap?.[o]) ?? i.options?.[0] ?? "";
        return { checklistItemId: i.id, nilai: aman };
      }
      if (i.answerType === "date") return { checklistItemId: i.id, nilai: "2099-01-01" };
      if (i.answerType === "text") return { checklistItemId: i.id, nilai: "uji" };
      return { checklistItemId: i.id, nilai: "ok" };
    });
    return { aset, gps: { lat: lat! + 0.5, lng: lng!, accuracy: 10 }, answers, divisionId: demo.divisionId };
  }

  async function kirim(user: SessionUser, siap: NonNullable<Awaited<ReturnType<typeof siapkan>>>) {
    const inspectionId = randomUUID();
    dibuat.push(inspectionId);
    await mulai(user, { inspectionId, token: siap.aset.qrToken, qrVerification: "online", assetId: siap.aset.id }, null);
    // Foto ditulis langsung ke tabel (tanpa blob store): finalisasi hanya memeriksa barisnya.
    const photoId = randomUUID();
    await db.insert(s.inspectionPhotos).values({ id: photoId, inspectionId, storageKey: `uji/${inspectionId}/${photoId}.jpg`, sha256: "0".repeat(64) });
    return finalisasi(user, inspectionId, {
      assetId: siap.aset.id,
      token: siap.aset.qrToken,
      qrVerification: "online",
      submittedAtDevice: new Date().toISOString(),
      gps: { ...siap.gps, capturedAt: new Date().toISOString() },
      answers: siap.answers,
      photoIds: [photoId],
      kesimpulan: "layak",
      rekomendasi: "uji",
      deviceClockOffsetMs: 0,
    }).then(
      (hasil) => ({ hasil, inspectionId }),
      (galat: { status?: number; kode?: string }) => ({ galat, inspectionId }),
    );
  }

  it("akun demo + AKUN_DEMO_LEWATI_KAWASAN=1: terkirim sebagai perlu_tinjauan / mode_demo, diaudit tanpa koordinat", async () => {
    const siap = await siapkan();
    if (!siap) return expect.soft(siap, "seed tanpa kawasan berpoligon / akun demo").not.toBeNull();
    const demo = (await penggunaInspektur(true, siap.divisionId))!;
    process.env[ENV_MODE_DEMO] = "1";
    const r = await kirim(demo, siap);
    expect("hasil" in r && r.hasil).toMatchObject({ status: "final", gateStatus: "perlu_tinjauan", gateAlasan: "mode_demo" });
    const [jejak] = await db
      .select()
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.entitasId, r.inspectionId), eq(s.auditLogs.aksi, "inspeksi.mode_demo")));
    expect(jejak?.data).toMatchObject({ assetId: siap.aset.id, akurasi: 10 });
    expect(JSON.stringify(jejak?.data)).not.toMatch(/lat|lng/);
  });

  it("akun demo dengan sakelar mati: tetap 422 di_luar_kawasan", async () => {
    const siap = await siapkan();
    if (!siap) return;
    const demo = (await penggunaInspektur(true, siap.divisionId))!;
    delete process.env[ENV_MODE_DEMO];
    const r = await kirim(demo, siap);
    expect("galat" in r && r.galat).toMatchObject({ status: 422, kode: "di_luar_kawasan" });
  });

  it("akun sungguhan walau sakelar menyala: tetap 422 di_luar_kawasan", async () => {
    const siap = await siapkan();
    if (!siap) return;
    const nyata = await penggunaInspektur(false, siap.divisionId);
    if (!nyata) return;
    process.env[ENV_MODE_DEMO] = "1";
    const r = await kirim(nyata, siap);
    expect("galat" in r && r.galat).toMatchObject({ status: 422, kode: "di_luar_kawasan" });
  });
});
