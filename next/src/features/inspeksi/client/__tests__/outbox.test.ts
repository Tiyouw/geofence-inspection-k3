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
  butirUntuk,
  langkahUntuk,
  simpanJepretan,
  simpanSemuaFoto,
  batalSesiFoto,
  ulangiLangkah,
} from "../aksi";
import { BACKOFF_MAKS_MS, jedaBackoff, klasifikasi, kuras, majukanSemua, opsInspeksi, pengirimHttp } from "../outbox";
import { fetchPalsu, paketContoh, TOKEN, TOKEN_LAIN, TOKEN_UNIT_LAIN } from "./helpers";

let db: DbAkun;
let uid = 1;
const paket = paketContoh();
const items = butirUntuk(paket, 1);
const langkah = langkahUntuk(paket, 1);
/** 10 = aset biasa, 11 = aset di area terbatas (helpers). */
const bukti = (areaTerbatas = false) => ({ langkah, areaTerbatas });

function jepret(inspectionId: string, kodeLangkah: string) {
  return simpanJepretan(db, {
    photoId: crypto.randomUUID(),
    inspectionId,
    langkah: kodeLangkah,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    contentType: "image/jpeg",
    sha256: "x",
    bytes: 3,
    width: 1,
    height: 1,
    takenAtDevice: new Date().toISOString(),
    lat: -8.18,
    lng: 113.7,
    akurasi: 12,
  });
}

async function siapkanPaket() {
  const { fn } = fetchPalsu(() => ({ status: 200, body: paket }));
  expect(await segarkanPaket(db, fn)).not.toBeNull();
}

async function drafLengkap(teks = TOKEN, daring = false) {
  const r = await mulaiDariTeks(db, teks, { daring });
  if (!r.ok) throw new Error(r.pesan);
  await simpanJawaban(db, r.inspectionId, 1, { nilai: "Penuh" }, items);
  await simpanJawaban(db, r.inspectionId, 2, { nilai: "ok" }, items);
  if (teks === TOKEN) {
    await jepret(r.inspectionId, "tabung");
    await jepret(r.inspectionId, "manometer");
    await simpanSemuaFoto(db, r.inspectionId);
  }
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
    const c = await mulaiDariTeks(db, "GIK3-" + "0".repeat(32), { daring: false });
    expect(c).toEqual({ ok: false, pesan: PESAN.tidakDikenaliLuring });
    expect(await mulaiDariTeks(db, "https://promo.example/x", { daring: false })).toEqual({ ok: false, pesan: PESAN.bukanStiker });
  });

  it("stiker aset unit lain: ditolak dengan nama unit pemilik, tanpa draf (PRD F2)", async () => {
    const r = await mulaiDariTeks(db, TOKEN_UNIT_LAIN, { daring: false });
    expect(r).toEqual({
      ok: false,
      pesan: "Aset ini milik Divisi Matra & K3LH. Anda hanya dapat menginspeksi aset SAT. PK.",
    });
    expect(await db.count("drafts")).toBe(0);
    expect(JSON.stringify(paket)).not.toContain(TOKEN_UNIT_LAIN);
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

  it("batas foto sama dengan peladen: 5 jepretan per langkah lolos pemeriksaan lokal (PWA-PLAN)", async () => {
    const id = await drafLengkap();
    // drafLengkap sudah 2 foto; tambah sampai 9 (2 langkah x 5 = 10 > batas lama 6).
    for (let n = 0; n < 4; n++) await jepret(id, "tabung");
    for (let n = 0; n < 3; n++) await jepret(id, "manometer");
    await simpanSemuaFoto(db, id);
    expect((await db.getAllFromIndex("photos", "byInspection", id)).length).toBe(9);
    expect((await kirimInspeksi(db, id, items, bukti())).ok).toBe(true);
  });

  it("kirim menjalankan pemeriksaan lokal dulu", async () => {
    const r = await mulaiDariTeks(db, TOKEN, { daring: false });
    if (!r.ok) throw new Error();
    const k = await kirimInspeksi(db, r.inspectionId, items, bukti());
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.galat).toContain("Masih ada butir tanpa jawaban atau langkah foto yang belum diisi: Tabung utuh, Manometer");
  });
});

describe("antrean dan sinkron (SPEC §7.5)", () => {
  it("urutan per inspeksi: start, foto, finalize; sukses menghapus draf dan foto", async () => {
    const id = await drafLengkap();
    expect((await kirimInspeksi(db, id, items, bukti())).ok).toBe(true);
    expect((await db.get("drafts", id))?.status).toBe("antre");

    const { fn, panggilan } = peladenOk();
    const h = await kuras(db, pengirimHttp(fn));
    expect(h).toMatchObject({ terkirim: 4, gagal: 0, tersisa: 0 });
    expect(panggilan.map((p) => `${p.method} ${p.url.replace(id, "ID").replace(/photos\/.+$/, "photos/F")}`)).toEqual([
      "POST /api/inspections/start",
      "PUT /api/inspections/ID/photos/F",
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
    await kirimInspeksi(db, id, items, bukti());
    let t = Date.now() + 1000;
    const luring = fetchPalsu(() => ({ status: 0, body: null }));
    const h1 = await kuras(db, pengirimHttp(luring.fn), { now: () => t, random: () => 0.5 });
    expect(h1).toMatchObject({ terkirim: 0, gagal: 1, tersisa: 4 });
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
    await kirimInspeksi(db, id, items, bukti());
    const { fn, panggilan } = fetchPalsu(() => ({ status: 401, body: { kode: "sesi_habis", pesan: "Masuk lagi" } }));
    const h = await kuras(db, pengirimHttp(fn));
    expect(h.sesiHabis).toBe(true);
    expect(panggilan).toHaveLength(1);
    expect(await db.count("outbox")).toBe(4);
  });

  it("422 menandai perlu tindakan; draf bisa dibuka kembali dan dikirim ulang", async () => {
    const id = await drafLengkap();
    await kirimInspeksi(db, id, items, bukti());
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
    await kirimInspeksi(db, a, items, bukti());
    await kirimInspeksi(db, b, items, bukti(true));
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
    expect((await opsInspeksi(db, id)).map((o) => o.kind)).toEqual(["start", "upload-photo"]);
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

describe("kamera terpandu: kumpulan foto (PRD Aturan bukti 3-4)", () => {
  async function drafTerjawab(teks = TOKEN) {
    const r = await mulaiDariTeks(db, teks, { daring: false });
    if (!r.ok) throw new Error(r.pesan);
    await simpanJawaban(db, r.inspectionId, 1, { nilai: "Penuh" }, items);
    await simpanJawaban(db, r.inspectionId, 2, { nilai: "ok" }, items);
    return r.inspectionId;
  }

  it("jepretan tersimpan di perangkat tetapi belum masuk antrean sampai Simpan semua", async () => {
    const id = await drafTerjawab();
    await jepret(id, "tabung");
    await jepret(id, "tabung");
    await jepret(id, "manometer");
    expect((await opsInspeksi(db, id)).map((o) => o.kind)).toEqual(["start"]);
    const k = await kirimInspeksi(db, id, items, bukti());
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.galat).toContain("Foto di kamera belum disimpan. Buka kamera terpandu lalu tekan Simpan semua.");

    expect(await simpanSemuaFoto(db, id)).toBe(3);
    expect((await opsInspeksi(db, id)).map((o) => o.kind)).toEqual(["start", "upload-photo", "upload-photo", "upload-photo"]);
    expect((await kirimInspeksi(db, id, items, bukti())).ok).toBe(true);
    const fin = (await opsInspeksi(db, id)).find((o) => o.kind === "finalize")!;
    expect((fin.payload.photos as { langkah: string }[]).map((p) => p.langkah).sort()).toEqual(["manometer", "tabung", "tabung"]);
  });

  it("ulangi langkah dan batal hanya membuang jepretan sesi; maksimal 5 per langkah", async () => {
    const id = await drafTerjawab();
    await jepret(id, "tabung");
    await simpanSemuaFoto(db, id);
    await jepret(id, "tabung");
    await jepret(id, "manometer");
    await ulangiLangkah(db, id, "tabung");
    let fotos = await db.getAllFromIndex("photos", "byInspection", id);
    expect(fotos.map((f) => [f.langkah, !!f.sesi]).sort()).toEqual([["manometer", true], ["tabung", false]]);
    await batalSesiFoto(db, id);
    fotos = await db.getAllFromIndex("photos", "byInspection", id);
    expect(fotos).toHaveLength(1);
    for (let i = 0; i < 4; i++) await jepret(id, "tabung");
    await expect(jepret(id, "tabung")).rejects.toThrow("Paling banyak 5 foto per langkah.");
  });

  it("area terbatas: dikirim tanpa foto", async () => {
    const id = await drafTerjawab(TOKEN_LAIN);
    expect((await kirimInspeksi(db, id, items, bukti(true))).ok).toBe(true);
  });

  it("unggahan membawa langkah, waktu, posisi, dan akurasi; diulang dengan kunci yang sama", async () => {
    const id = await drafTerjawab();
    await jepret(id, "tabung");
    await jepret(id, "manometer");
    await simpanSemuaFoto(db, id);
    await kirimInspeksi(db, id, items, bukti());
    const header: Headers[] = [];
    let gagalSekali = true;
    const { fn, panggilan } = fetchPalsu(({ method, headers, url }) => {
      if (method === "PUT") {
        header.push(headers);
        if (gagalSekali) {
          gagalSekali = false;
          return { status: 503, body: { pesan: "sibuk" } };
        }
      }
      if (url.endsWith("/finalize")) {
        return { status: 200, body: { inspectionId: id, status: "final", kodeAset: "01D", inspectedAt: new Date().toISOString(), offline: false, kesimpulan: "layak", gateStatus: "sesuai", jarakM: 1, qrVerified: true, jumlahFoto: 2, temuan: [] } };
      }
      return { status: 200, body: {} };
    });
    let t = Date.now();
    await kuras(db, pengirimHttp(fn), { now: () => t });
    t += BACKOFF_MAKS_MS;
    await kuras(db, pengirimHttp(fn), { now: () => t });
    expect(await db.get("sent", id)).toBeDefined();
    const puts = panggilan.filter((p) => p.method === "PUT");
    expect(puts[0]!.key).toBe(puts[1]!.key);
    expect(new Set(header.map((h) => h.get("x-step")))).toEqual(new Set(["tabung", "manometer"]));
    expect(header[0]!.get("x-accuracy")).toBe("12");
    expect(header[0]!.get("x-lat")).toBe("-8.18");
    expect(header[0]!.get("x-taken-at")).toMatch(/^\d{4}-/);
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

import { statusAntrean } from "../status";

describe("label status antrean (SPEC §7.9)", () => {
  const draf = { inspectionId: "a", status: "antre", pesan: null } as unknown as import("../types").DrafLokal;
  const op = (p: Partial<import("../types").OutboxOp>) =>
    ({ opId: "o", kind: "finalize", inspectionId: "a", seq: 1, payload: {}, attempts: 0, nextAttemptAt: 0, status: "pending", lastError: null, errorKode: null, createdAt: 0, ...p }) as import("../types").OutboxOp;

  it("luring: menunggu sinyal", () => {
    expect(statusAntrean(draf, [op({})], undefined, false).label).toBe("Menunggu sinyal");
  });
  it("daring dengan foto tersisa", () => {
    expect(statusAntrean(draf, [op({ kind: "upload-photo" })], { total: 3, terunggah: 1 }, true).label).toBe("Mengirim foto 2/3");
  });
  it("coba ulang terjadwal", () => {
    expect(statusAntrean(draf, [op({ attempts: 2, nextAttemptAt: 31_000 })], undefined, true, 1_000).label).toBe("Gagal, coba lagi 30 dtk");
  });
  it("perlu tindakan dan sesi habis", () => {
    expect(statusAntrean(draf, [op({ status: "needs_action", lastError: "Stiker tidak dikenali" })], undefined, true).label).toBe(
      "Perlu tindakan: Stiker tidak dikenali",
    );
    expect(statusAntrean(draf, [op({ errorKode: "sesi_habis" })], undefined, true).perluTindakan).toBe(true);
  });
});
