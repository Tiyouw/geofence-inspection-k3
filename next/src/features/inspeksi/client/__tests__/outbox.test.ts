import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { bukaDb, setMeta, tutupDb, type DbAkun } from "../db";
import {
  buangDraf,
  bukaKembali,
  hapusFotoLokal,
  kirimInspeksi,
  mulaiDariTeks,
  PESAN,
  segarkanPaket,
  simpanGps,
  simpanIsian,
  simpanJawaban,
  sinkronJam,
  tambahFoto,
  butirUntuk,
} from "../aksi";
import { BACKOFF_MAKS_MS, jedaBackoff, klasifikasi, kuras, majukanSemua, opsInspeksi, pengirimHttp } from "../outbox";
import { fetchPalsu, paketContoh, TOKEN, TOKEN_LAIN } from "./helpers";

let db: DbAkun;
let uid = 1;
const paket = paketContoh();
const items = butirUntuk(paket, 1);

async function siapkanPaket() {
  const { fn } = fetchPalsu(() => ({ status: 200, body: paket }));
  expect(await segarkanPaket(db, fn)).not.toBeNull();
}

async function drafLengkap(teks = TOKEN, daring = false) {
  const r = await mulaiDariTeks(db, teks, { daring });
  if (!r.ok) throw new Error(r.pesan);
  await simpanJawaban(db, r.inspectionId, 1, { nilai: "Penuh" }, items);
  await simpanJawaban(db, r.inspectionId, 2, { nilai: "ok" }, items);
  await tambahFoto(db, {
    photoId: crypto.randomUUID(),
    inspectionId: r.inspectionId,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    contentType: "image/jpeg",
    sha256: "x",
    bytes: 3,
    width: 1,
    height: 1,
    takenAtDevice: new Date().toISOString(),
    lat: null,
    lng: null,
  });
  return r.inspectionId;
}

/** Peladen tiruan yang menerima semuanya dan mengembalikan hasil final. */
function peladenOk() {
  return fetchPalsu(({ url }) => {
    if (url.endsWith("/finalize")) {
      return { status: 200, body: { inspectionId: url.split("/")[3], status: "final", kodeAset: "01D", inspectedAt: new Date().toISOString(), offline: true, kesimpulan: "layak", gateStatus: "tanpa_gps", jarakM: null, qrVerified: true, jumlahFoto: 1, temuan: [] } };
    }
    return { status: 200, body: { ok: true } };
  });
}

beforeEach(async () => {
  db = await bukaDb(uid++);
  await siapkanPaket();
});

describe("pindai luring dengan cache HMAC (SPEC §7.7)", () => {
  it("token yang cocok membuat draf luring dan operasi start", async () => {
    const r = await mulaiDariTeks(db, `https://geofencinspection.tech/i/${TOKEN}`, { daring: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await db.get("drafts", r.inspectionId);
    expect(d?.assetId).toBe(10);
    expect(d?.qrVerification).toBe("offline_cache");
    const ops = await opsInspeksi(db, r.inspectionId);
    expect(ops.map((o) => o.kind)).toEqual(["start"]);
    expect(ops[0]!.payload.token).toBe(TOKEN);
  });

  it("paket tidak memuat token mentah", () => {
    expect(JSON.stringify(paket)).not.toContain(TOKEN);
  });

  it("pindai ulang memakai draf yang sama; token tak dikenal ditolak", async () => {
    const a = await mulaiDariTeks(db, TOKEN, { daring: false });
    const b = await mulaiDariTeks(db, TOKEN, { daring: false });
    expect(a.ok && b.ok && a.inspectionId === b.inspectionId && b.dipakaiUlang).toBe(true);
    const c = await mulaiDariTeks(db, "PAL-K3-" + "0".repeat(32), { daring: false });
    expect(c).toEqual({ ok: false, pesan: PESAN.tidakDikenaliLuring });
    expect(await mulaiDariTeks(db, "https://promo.example/x", { daring: false })).toEqual({ ok: false, pesan: PESAN.bukanStiker });
  });
});

describe("isian di perangkat", () => {
  it("usulan kesimpulan mengikuti jawaban sampai inspektur memilih sendiri", async () => {
    const r = await mulaiDariTeks(db, TOKEN, { daring: false });
    if (!r.ok) throw new Error();
    let d = await simpanJawaban(db, r.inspectionId, 1, { nilai: "Tidak penuh" }, items);
    expect(d.kesimpulan).toBe("tidak_layak");
    d = await simpanIsian(db, r.inspectionId, { kesimpulan: "layak_catatan" });
    d = await simpanJawaban(db, r.inspectionId, 2, { nilai: "ok" }, items);
    expect(d.kesimpulan).toBe("layak_catatan");
  });

  it("GPS: bacaan paling akurat yang dipakai", async () => {
    const r = await mulaiDariTeks(db, TOKEN, { daring: false });
    if (!r.ok) throw new Error();
    await simpanGps(db, r.inspectionId, { lat: 1, lng: 1, accuracy: 30, capturedAt: "2026-11-16T00:00:00Z" });
    const d = await simpanGps(db, r.inspectionId, { lat: 2, lng: 2, accuracy: 80, capturedAt: "2026-11-16T00:01:00Z" });
    expect(d.gps?.accuracy).toBe(30);
  });

  it("kirim menjalankan pemeriksaan lokal dulu", async () => {
    const r = await mulaiDariTeks(db, TOKEN, { daring: false });
    if (!r.ok) throw new Error();
    const k = await kirimInspeksi(db, r.inspectionId, items);
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.galat).toContain("Foto wajib diunggah minimal satu sebelum inspeksi dikirim.");
  });
});

describe("antrean dan sinkron (SPEC §7.5)", () => {
  it("urutan per inspeksi: start, foto, finalize; sukses menghapus draf dan foto", async () => {
    const id = await drafLengkap();
    expect((await kirimInspeksi(db, id, items)).ok).toBe(true);
    expect((await db.get("drafts", id))?.status).toBe("antre");

    const { fn, panggilan } = peladenOk();
    const h = await kuras(db, pengirimHttp(fn));
    expect(h).toMatchObject({ terkirim: 3, gagal: 0, tersisa: 0 });
    expect(panggilan.map((p) => `${p.method} ${p.url.replace(id, "ID").replace(/photos\/.+$/, "photos/F")}`)).toEqual([
      "POST /api/inspections/start",
      "PUT /api/inspections/ID/photos/F",
      "POST /api/inspections/ID/finalize",
    ]);
    expect(panggilan.every((p) => p.key && /^[0-9a-f-]{36}$/.test(p.key))).toBe(true);
    expect(await db.get("drafts", id)).toBeUndefined();
    expect(await db.countFromIndex("photos", "byInspection", id)).toBe(0);
    expect((await db.get("sent", id))?.kode).toBe("01D");
  });

  it("tanpa sinyal: tetap di antrean dengan backoff, kunci idempotensi sama saat diulang", async () => {
    const id = await drafLengkap();
    await kirimInspeksi(db, id, items);
    let t = Date.now() + 1000;
    const luring = fetchPalsu(() => ({ status: 0, body: null }));
    const h1 = await kuras(db, pengirimHttp(luring.fn), { now: () => t, random: () => 0.5 });
    expect(h1).toMatchObject({ terkirim: 0, gagal: 1, tersisa: 3 });
    const [start] = await opsInspeksi(db, id);
    expect(start!.attempts).toBe(1);
    expect(start!.nextAttemptAt).toBe(t + 2000);

    // sebelum jeda habis tidak dicoba
    await kuras(db, pengirimHttp(luring.fn), { now: () => t + 1000 });
    expect(luring.panggilan).toHaveLength(1);

    t += 2500;
    const ok = peladenOk();
    await kuras(db, pengirimHttp(ok.fn), { now: () => t });
    expect(ok.panggilan[0]!.key).toBe(luring.panggilan[0]!.key);
    expect(await db.count("outbox")).toBe(0);
  });

  it("401 menghentikan pengurasan dan menyimpan antrean", async () => {
    const id = await drafLengkap();
    await kirimInspeksi(db, id, items);
    const { fn, panggilan } = fetchPalsu(() => ({ status: 401, body: { kode: "sesi_habis", pesan: "Masuk lagi" } }));
    const h = await kuras(db, pengirimHttp(fn));
    expect(h.sesiHabis).toBe(true);
    expect(panggilan).toHaveLength(1);
    expect(await db.count("outbox")).toBe(3);
  });

  it("422 menandai perlu tindakan; draf bisa dibuka kembali dan dikirim ulang", async () => {
    const id = await drafLengkap();
    await kirimInspeksi(db, id, items);
    const { fn } = fetchPalsu(({ url }) =>
      url.endsWith("/finalize") ? { status: 422, body: { kode: "validasi", pesan: "Butir wajib baru belum diisi" } } : { status: 200, body: {} },
    );
    await kuras(db, pengirimHttp(fn));
    const d = await db.get("drafts", id);
    expect(d?.status).toBe("perlu_tindakan");
    expect(d?.pesan).toBe("Butir wajib baru belum diisi");
    await bukaKembali(db, id);
    expect((await db.get("drafts", id))?.status).toBe("draf");
    expect((await opsInspeksi(db, id)).some((o) => o.kind === "finalize")).toBe(false);
  });

  it("antrean satu inspeksi yang macet tidak menahan inspeksi lain", async () => {
    const a = await drafLengkap(TOKEN);
    const b = await drafLengkap(TOKEN_LAIN);
    await kirimInspeksi(db, a, items);
    await kirimInspeksi(db, b, items);
    const { fn } = fetchPalsu(({ url, body }) => {
      const id = (body as { inspectionId?: string } | undefined)?.inspectionId ?? url.split("/")[3];
      if (id === a) return { status: 503, body: { pesan: "sibuk" }, headers: { "retry-after": "30" } };
      if (url.endsWith("/finalize")) return { status: 200, body: { inspectionId: b, status: "final", kodeAset: "02D", inspectedAt: new Date().toISOString(), offline: false, kesimpulan: "layak", gateStatus: "sesuai", jarakM: 1, qrVerified: true, jumlahFoto: 1, temuan: [] } };
      return { status: 200, body: {} };
    });
    const t0 = Date.now() + 1000;
    await kuras(db, pengirimHttp(fn), { now: () => t0 });
    expect(await db.get("sent", b)).toBeDefined();
    const [opA] = await opsInspeksi(db, a);
    expect(opA!.nextAttemptAt).toBeGreaterThanOrEqual(t0 + 30_000); // Retry-After dihormati
    await majukanSemua(db, t0 + 1);
    expect((await opsInspeksi(db, a))[0]!.nextAttemptAt).toBe(t0 + 1);
  });

  it("buang draf yang belum sampai peladen tidak mengirim apa pun; foto belum terunggah cukup dibatalkan", async () => {
    const id = await drafLengkap();
    const [foto] = await db.getAllFromIndex("photos", "byInspection", id);
    await hapusFotoLokal(db, id, foto!.photoId);
    expect((await opsInspeksi(db, id)).map((o) => o.kind)).toEqual(["start"]);
    await buangDraf(db, id);
    expect(await db.count("outbox")).toBe(0);
    expect(await db.get("drafts", id)).toBeUndefined();
  });

  it("buang draf yang sudah sampai peladen mengantrekan discard", async () => {
    const id = await drafLengkap();
    const { fn } = peladenOk();
    await kuras(db, pengirimHttp(fn));
    await buangDraf(db, id);
    expect((await db.getAll("outbox")).map((o) => o.kind)).toEqual(["discard"]);
  });
});

describe("jam dan backoff", () => {
  it("offset jam peladen dari /api/time", async () => {
    const servernow = new Date(Date.now() + 120_000).toISOString();
    const { fn } = fetchPalsu(() => ({ status: 200, body: { now: servernow } }));
    const off = await sinkronJam(db, fn);
    expect(off).toBeGreaterThan(115_000);
    expect(off).toBeLessThan(125_000);
  });

  it("backoff 2 s, 4 s, 8 s … maks 5 menit", () => {
    const tanpaJitter = () => 0.5;
    expect([1, 2, 3, 4].map((n) => jedaBackoff(n, tanpaJitter))).toEqual([2000, 4000, 8000, 16000]);
    expect(jedaBackoff(20, () => 1)).toBe(BACKOFF_MAKS_MS);
    expect(jedaBackoff(1, tanpaJitter, 60_000)).toBe(60_000);
  });

  it("klasifikasi galat", () => {
    expect(klasifikasi(503, null, null).jenis).toBe("ulang");
    expect(klasifikasi(429, null, "5")).toMatchObject({ jenis: "ulang", retryAfterMs: 5000 });
    expect(klasifikasi(409, { kode: "foto_belum_lengkap" }, null).jenis).toBe("ulang");
    expect(klasifikasi(410, { kode: "token_tidak_dikenal", pesan: "x" }, null)).toMatchObject({ jenis: "tindakan" });
    expect(klasifikasi(401, null, null).jenis).toBe("sesi_habis");
  });
});

describe("pemisahan per akun", () => {
  it("antrean akun lain tidak terlihat", async () => {
    await drafLengkap();
    const lain = await bukaDb(9999);
    expect(await lain.count("outbox")).toBe(0);
    await tutupDb(9999);
    await setMeta(db, "seq", 100);
  });
});
