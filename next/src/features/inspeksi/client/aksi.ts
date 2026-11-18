/**
 * Aksi inspektur di perangkat. Semua isian ditulis ke IndexedDB dulu, baru dikirim lewat
 * outbox (SPEC §7.1). Modul ini tidak memakai DOM selain fetch/crypto, sehingga bisa diuji.
 */
import { pesanAsetUnitLain } from "@/lib/domain/akses";
import { MAKS_FOTO } from "@/lib/domain/constants";
import { langkahCadangan, MAKS_JEPRETAN_LANGKAH, maksFotoInspeksi, periksaFotoLangkah, type LangkahFoto } from "@/lib/domain/langkah-foto";
import { ambilToken, bangunTemuan, miripNomorAset, periksaKirim, usulanKesimpulan, type ButirChecklist } from "@/lib/domain/inspeksi";
import type { KonteksP3k } from "@/lib/domain/modul/p3k";
import { getMeta, setMeta, type DbAkun } from "./db";
import { monoNow, uuidv7 } from "./ids";
import { buatOp, opsInspeksi, tambahOp } from "./outbox";
import type { AsetPaket, DrafLokal, FotoLokal, GpsBacaan, JawabanLokal, PaketKerja } from "./types";

const nowIso = () => new Date().toISOString();

/* ---------- jam dan paket kerja ---------- */

/** SPEC §7.6: offset = jamPeladen − jamPerangkat, dari /api/time dengan koreksi waktu tempuh. */
export async function sinkronJam(db: DbAkun, fetchFn: typeof fetch = fetch): Promise<number | null> {
  try {
    const t0 = Date.now();
    const res = await fetchFn("/api/time", { cache: "no-store" });
    const t1 = Date.now();
    if (!res.ok) return null;
    const { now } = (await res.json()) as { now: string };
    const offset = Math.round(new Date(now).getTime() - (t0 + t1) / 2);
    await setMeta(db, "serverClockOffsetMs", offset);
    return offset;
  } catch {
    return null;
  }
}

function base64KeBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Unduh paket kerja; kunci HMAC disimpan sebagai CryptoKey non-extractable (SPEC §7.7). */
export async function segarkanPaket(db: DbAkun, fetchFn: typeof fetch = fetch): Promise<PaketKerja | null> {
  try {
    const res = await fetchFn("/api/field/bundle", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const paket = (await res.json()) as PaketKerja;
    const key = await crypto.subtle.importKey("raw", base64KeBytes(paket.hmacKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    await setMeta(db, "hmacKey", key);
    await setMeta(db, "paket", { ...paket, hmacKey: "" });
    await setMeta(db, "paketDiperbarui", nowIso());
    return paket;
  } catch {
    return null;
  }
}

export async function hmacHex(key: CryptoKey, token: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  return Array.from(new Uint8Array(sig), (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function cariAsetDariToken(db: DbAkun, token: string): Promise<AsetPaket | null> {
  const [paket, key] = await Promise.all([getMeta(db, "paket"), getMeta(db, "hmacKey")]);
  if (!paket || !key) return null;
  const h = await hmacHex(key, token);
  return paket.aset.find((a) => a.qrTokenHash === h) ?? null;
}

/** Stiker aset milik unit lain (PRD F2): pesan yang menyebut pemiliknya, atau null. */
export async function pesanUnitLain(db: DbAkun, token: string): Promise<string | null> {
  const [paket, key] = await Promise.all([getMeta(db, "paket"), getMeta(db, "hmacKey")]);
  if (!paket?.asetUnitLain || !key) return null;
  const h = await hmacHex(key, token);
  const lain = paket.asetUnitLain.find((a) => a.qrTokenHash === h);
  return lain ? pesanAsetUnitLain(lain.unit, paket.unit ?? null) : null;
}

export function butirUntuk(paket: PaketKerja, assetTypeId: number): ButirChecklist[] {
  return (paket.checklist[assetTypeId] ?? []).flatMap((g) => g.items);
}

/** Langkah kamera terpandu; paket lama tanpa langkah memakai cadangan per grup. */
export function langkahUntuk(paket: PaketKerja, assetTypeId: number): LangkahFoto[] {
  return paket.langkahFoto?.[assetTypeId] ?? langkahCadangan(paket.checklist[assetTypeId] ?? []);
}

/* ---------- pindai ---------- */

export type HasilMulai =
  | { ok: true; inspectionId: string; dipakaiUlang: boolean }
  | { ok: false; pesan: string };

export const PESAN = {
  bukanStiker: "Kode ini bukan stiker inspeksi K3. Coba stiker yang benar.",
  nomorAset:
    "Itu nomor aset. Ketik kode panjang PAL-K3-… yang tercetak kecil di bawah QR (spasi dan huruf besar tidak masalah), atau pindai QR-nya.",
  tidakDikenali: "Stiker tidak dikenali. Laporkan ke Admin K3.",
  tidakDikenaliLuring:
    "Stiker tidak dikenali atau data stiker belum diperbarui. Simpan foto stiker dan coba saat ada sinyal.",
  belumAdaPaket: "Data stiker belum diunduh. Buka aplikasi sekali saat ada sinyal.",
} as const;

/**
 * SPEC §3.2 + §7.3 butir 2: QR penentu aset. Cocokkan hash token dengan paket; draf lokal
 * untuk aset yang sama dipakai ulang; draf baru dibuat dengan UUIDv7 dan operasi `start` masuk antrean.
 */
export async function mulaiDariTeks(
  db: DbAkun,
  teks: string,
  opts: { daring: boolean; fetchFn?: typeof fetch } ,
): Promise<HasilMulai> {
  const token = ambilToken(teks);
  if (!token) return { ok: false, pesan: miripNomorAset(teks) ? PESAN.nomorAset : PESAN.bukanStiker };

  let aset = await cariAsetDariToken(db, token);
  if (!aset && opts.daring) {
    // Mungkin aset baru atau token diganti: segarkan paket lalu coba lagi.
    if (await segarkanPaket(db, opts.fetchFn)) aset = await cariAsetDariToken(db, token);
  }
  if (!aset) {
    if (!(await getMeta(db, "paket"))) return { ok: false, pesan: PESAN.belumAdaPaket };
    const unitLain = await pesanUnitLain(db, token);
    if (unitLain) return { ok: false, pesan: unitLain };
    return { ok: false, pesan: opts.daring ? PESAN.tidakDikenali : PESAN.tidakDikenaliLuring };
  }

  const drafAset = (await db.getAllFromIndex("drafts", "byAsset", aset.id)).find((d) => d.status !== "antre");
  if (drafAset) return { ok: true, inspectionId: drafAset.inspectionId, dipakaiUlang: true };

  const inspectionId = uuidv7();
  const scannedAtDevice = nowIso();
  const qrVerification = opts.daring ? "online" : "offline_cache";
  const draf: DrafLokal = {
    inspectionId,
    assetId: aset.id,
    token,
    qrVerification,
    scannedAtDevice,
    scannedMono: monoNow(),
    status: "draf",
    gps: null,
    jawaban: {},
    kesimpulan: "layak",
    kesimpulanManual: false,
    catatan: "",
    rekomendasi: "",
    submittedAtDevice: null,
    pesan: null,
    createdAt: scannedAtDevice,
    updatedAt: scannedAtDevice,
  };
  await db.put("drafts", draf);
  await tambahOp(db, "start", inspectionId, { token, scannedAtDevice, qrVerification, assetId: aset.id });
  return { ok: true, inspectionId, dipakaiUlang: false };
}

/* ---------- isian ---------- */

async function ubahDraf(db: DbAkun, inspectionId: string, fn: (d: DrafLokal) => DrafLokal): Promise<DrafLokal> {
  const tx = db.transaction("drafts", "readwrite");
  const d = await tx.store.get(inspectionId);
  if (!d) throw new Error("Draf tidak ditemukan di perangkat.");
  if (d.status === "antre") throw new Error("Inspeksi sudah masuk antrean kirim.");
  const baru = { ...fn(d), updatedAt: nowIso() };
  await tx.store.put(baru);
  await tx.done;
  return baru;
}

/** Usulan kesimpulan diperbarui tiap jawaban, kecuali inspektur sudah memilih sendiri (SPEC §3.4). */
function denganUsulan(d: DrafLokal, items: ButirChecklist[], p3k: KonteksP3k | null): DrafLokal {
  if (d.kesimpulanManual) return d;
  const jawaban = Object.entries(d.jawaban).map(([id, j]) => ({ checklistItemId: Number(id), ...j }));
  return { ...d, kesimpulan: usulanKesimpulan(bangunTemuan(items, jawaban, p3k)) };
}

export function simpanJawaban(
  db: DbAkun,
  inspectionId: string,
  itemId: number,
  isi: Omit<JawabanLokal, "answeredAt">,
  items: ButirChecklist[],
  p3k: KonteksP3k | null = null,
) {
  return ubahDraf(db, inspectionId, (d) =>
    denganUsulan({ ...d, jawaban: { ...d.jawaban, [itemId]: { ...d.jawaban[itemId], ...isi, answeredAt: nowIso() } } }, items, p3k),
  );
}

export function simpanIsian(
  db: DbAkun,
  inspectionId: string,
  isi: Partial<Pick<DrafLokal, "kesimpulan" | "catatan" | "rekomendasi">>,
) {
  return ubahDraf(db, inspectionId, (d) => ({ ...d, ...isi, kesimpulanManual: d.kesimpulanManual || isi.kesimpulan !== undefined }));
}

/** SPEC §7.3 butir 3: bacaan dengan akurasi terbaik dalam jendela pengisian yang dipakai. */
export function simpanGps(db: DbAkun, inspectionId: string, bacaan: GpsBacaan, paksa = false) {
  return ubahDraf(db, inspectionId, (d) =>
    paksa || !d.gps || bacaan.accuracy <= d.gps.accuracy ? { ...d, gps: bacaan } : d,
  );
}

/* ---------- foto: kamera terpandu (PRD Aturan bukti 3) ---------- */

async function drafBisaDiubah(db: DbAkun, inspectionId: string) {
  const d = await db.get("drafts", inspectionId);
  if (!d || d.status === "antre") throw new Error("Draf tidak bisa diubah.");
  return d;
}

/**
 * Jepretan masuk IndexedDB seketika, tetapi belum ke antrean unggah (`sesi: true`) sampai
 * inspektur menekan "Simpan semua". Maksimal 5 per langkah, termasuk yang sudah tersimpan.
 */
export async function simpanJepretan(db: DbAkun, foto: Omit<FotoLokal, "uploaded" | "sesi"> & { langkah: string }) {
  await drafBisaDiubah(db, foto.inspectionId);
  const ada = (await db.getAllFromIndex("photos", "byInspection", foto.inspectionId)).filter((f) => f.langkah === foto.langkah);
  if (ada.length >= MAKS_JEPRETAN_LANGKAH) throw new Error(`Paling banyak ${MAKS_JEPRETAN_LANGKAH} foto per langkah.`);
  await db.put("photos", { ...foto, sesi: true, uploaded: false });
}

/** Simpan semua jepretan sesi sekaligus: satu transaksi, satu operasi unggah per foto (Idempotency-Key per foto). */
export async function simpanSemuaFoto(db: DbAkun, inspectionId: string): Promise<number> {
  await drafBisaDiubah(db, inspectionId);
  const tx = db.transaction(["photos", "outbox", "meta"], "readwrite");
  const fotos = (await tx.objectStore("photos").index("byInspection").getAll(inspectionId))
    .filter((f) => f.sesi)
    .sort((a, b) => a.takenAtDevice.localeCompare(b.takenAtDevice));
  let seq = ((await tx.objectStore("meta").get("seq")) as number | undefined) ?? 0;
  const now = Date.now();
  for (const f of fotos) {
    await tx.objectStore("photos").put({ ...f, sesi: false });
    await tx.objectStore("outbox").put(buatOp("upload-photo", inspectionId, { photoId: f.photoId }, ++seq, now));
  }
  await tx.objectStore("meta").put(seq, "seq");
  await tx.done;
  return fotos.length;
}

/** Tutup kamera tanpa menyimpan: jepretan sesi dibuang, foto yang sudah tersimpan tetap. */
export async function batalSesiFoto(db: DbAkun, inspectionId: string) {
  const tx = db.transaction("photos", "readwrite");
  for (const f of await tx.store.index("byInspection").getAll(inspectionId)) {
    if (f.sesi) await tx.store.delete(f.photoId);
  }
  await tx.done;
}

/** Ulangi satu langkah sebelum menyimpan: jepretan sesi langkah itu dihapus. */
export async function ulangiLangkah(db: DbAkun, inspectionId: string, langkah: string) {
  const tx = db.transaction("photos", "readwrite");
  for (const f of await tx.store.index("byInspection").getAll(inspectionId)) {
    if (f.sesi && f.langkah === langkah) await tx.store.delete(f.photoId);
  }
  await tx.done;
}

export async function hapusFotoLokal(db: DbAkun, inspectionId: string, photoId: string) {
  const foto = await db.get("photos", photoId);
  if (foto?.sesi) return db.delete("photos", photoId); // belum pernah masuk antrean
  const ops = await opsInspeksi(db, inspectionId);
  const unggah = ops.find((o) => o.kind === "upload-photo" && o.payload.photoId === photoId);
  await db.delete("photos", photoId);
  if (unggah) await db.delete("outbox", unggah.opId); // belum terkirim: cukup batalkan
  else await tambahOp(db, "delete-photo", inspectionId, { photoId });
}

/* ---------- kirim dan buang ---------- */

export async function kirimInspeksi(
  db: DbAkun,
  inspectionId: string,
  items: ButirChecklist[],
  opsi: { langkah: LangkahFoto[]; areaTerbatas: boolean; p3k?: KonteksP3k | null },
): Promise<{ ok: true } | { ok: false; galat: string[] }> {
  const p3k = opsi.p3k ?? null;
  const d = await db.get("drafts", inspectionId);
  if (!d) return { ok: false, galat: ["Draf tidak ditemukan di perangkat."] };
  const semua = await db.getAllFromIndex("photos", "byInspection", inspectionId);
  const fotos = semua.filter((f) => !f.sesi);
  const galatFoto = semua.some((f) => f.sesi)
    ? ["Foto di kamera belum disimpan. Buka kamera terpandu lalu tekan Simpan semua."]
    : periksaFotoLangkah(opsi.langkah, fotos.map((f) => ({ langkah: f.langkah ?? "" })), { areaTerbatas: opsi.areaTerbatas });
  const jawaban = Object.entries(d.jawaban).map(([id, j]) => ({
    checklistItemId: Number(id),
    nilai: j.nilai ?? null,
    nilaiAngka: j.nilaiAngka ?? null,
    catatan: j.catatan ?? null,
    ...(j.kondisiIsi !== undefined || j.tglKedaluwarsaTerdekat !== undefined
      ? { kondisiIsi: j.kondisiIsi ?? null, tglKedaluwarsaTerdekat: j.tglKedaluwarsaTerdekat ?? null }
      : {}),
    tindakanRekomendasi: j.tindakanRekomendasi ?? null,
    uraianTindakan: j.uraianTindakan ?? null,
    answeredAt: j.answeredAt,
  }));
  const galat = periksaKirim(
    items,
    { jawaban, jumlahFoto: fotos.length, galatFoto, kesimpulan: d.kesimpulan, catatan: d.catatan, rekomendasi: d.rekomendasi, p3k },
    // Batas sama dengan peladen (inspeksi.ts): kamera terpandu boleh 5 jepretan per langkah.
    Math.max(MAKS_FOTO, maksFotoInspeksi(opsi.langkah)),
  );
  if (galat.length) return { ok: false, galat };

  const submittedAtDevice = nowIso();
  const offset = (await getMeta(db, "serverClockOffsetMs")) ?? 0;
  // Operasi finalize lama yang macet (perlu tindakan) diganti dengan kiriman baru.
  for (const op of await opsInspeksi(db, inspectionId)) {
    if (op.kind === "finalize") await db.delete("outbox", op.opId);
    else if (op.status === "needs_action") await db.put("outbox", { ...op, status: "pending", nextAttemptAt: Date.now() });
  }
  await db.put("drafts", { ...d, status: "antre", submittedAtDevice, pesan: null, updatedAt: submittedAtDevice });
  await tambahOp(db, "finalize", inspectionId, {
    assetId: d.assetId,
    token: d.token,
    qrVerification: d.qrVerification,
    scannedAtDevice: d.scannedAtDevice,
    submittedAtDevice,
    monoDurationMs: Math.max(0, Math.round(monoNow() - d.scannedMono)),
    gps: d.gps,
    answers: jawaban,
    photoIds: fotos.map((f) => f.photoId),
    photos: fotos.map((f) => ({ id: f.photoId, langkah: f.langkah ?? null })),
    kesimpulan: d.kesimpulan,
    catatan: d.catatan || null,
    rekomendasi: d.rekomendasi || null,
    deviceClockOffsetMs: offset,
  });
  return { ok: true };
}

/** Buka kembali draf yang perlu tindakan supaya bisa diperbaiki (SPEC §7.5: 422 → buka kembali). */
export async function bukaKembali(db: DbAkun, inspectionId: string) {
  const d = await db.get("drafts", inspectionId);
  if (!d) return;
  for (const op of await opsInspeksi(db, inspectionId)) {
    if (op.kind === "finalize") await db.delete("outbox", op.opId);
  }
  await db.put("drafts", { ...d, status: "draf", updatedAt: nowIso() });
}

/** Buang draf beserta fotonya. Bila draf belum pernah sampai peladen, cukup dihapus lokal. */
export async function buangDraf(db: DbAkun, inspectionId: string) {
  const ops = await opsInspeksi(db, inspectionId);
  const startMasihAntre = ops.some((o) => o.kind === "start");
  const tx = db.transaction(["drafts", "photos", "outbox"], "readwrite");
  await tx.objectStore("drafts").delete(inspectionId);
  for (const k of await tx.objectStore("photos").index("byInspection").getAllKeys(inspectionId)) await tx.objectStore("photos").delete(k);
  for (const o of ops) await tx.objectStore("outbox").delete(o.opId);
  await tx.done;
  if (!startMasihAntre) await tambahOp(db, "discard", inspectionId, {});
}
