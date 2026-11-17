/**
 * Antrean kiriman (SPEC §7.5). Dipakai jendela dan service worker (Background Sync).
 *
 * - Setiap operasi membawa Idempotency-Key = opId.
 * - FIFO per inspeksi; antar-inspeksi paralel paling banyak 2.
 * - Galat jaringan/5xx/429/408 dan kondisi sementara dicoba ulang dengan backoff
 *   eksponensial + jitter (2 s, 4 s, 8 s … maks 5 menit), menghormati Retry-After, tanpa batas jumlah.
 * - 401: berhenti, semua tetap di antrean ("Masuk lagi").
 * - 403/409/410/422 lainnya: "perlu tindakan", tidak dicoba ulang otomatis.
 */
import { getMeta, setMeta, type DbAkun } from "./db";
import { uuidv7 } from "./ids";
import type { HasilFinal, JenisOp, OutboxOp } from "./types";

export const BACKOFF_DASAR_MS = 2_000;
export const BACKOFF_MAKS_MS = 5 * 60_000;
export const PARALEL = 2;

/** Kode galat peladen yang berarti "tunggu langkah sebelumnya", bukan kesalahan isian. */
const KODE_SEMENTARA = new Set(["draf_tidak_ada", "foto_belum_lengkap"]);

export function jedaBackoff(attempts: number, random: () => number = Math.random, retryAfterMs?: number | null): number {
  const dasar = Math.min(BACKOFF_MAKS_MS, BACKOFF_DASAR_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = dasar * (0.8 + 0.4 * random());
  return Math.max(Math.min(BACKOFF_MAKS_MS, Math.round(jitter)), retryAfterMs ?? 0);
}

export type Klasifikasi =
  | { jenis: "ok" }
  | { jenis: "ulang"; retryAfterMs: number | null; pesan: string }
  | { jenis: "sesi_habis"; pesan: string }
  | { jenis: "tindakan"; kode: string; pesan: string };

export function klasifikasi(status: number, body: { kode?: string; pesan?: string } | null, retryAfter: string | null): Klasifikasi {
  if (status >= 200 && status < 300) return { jenis: "ok" };
  const pesan = body?.pesan ?? `Galat ${status}`;
  if (status === 401) return { jenis: "sesi_habis", pesan: "Masuk lagi untuk mengirim antrean." };
  if (status >= 500 || status === 429 || status === 408 || (body?.kode && KODE_SEMENTARA.has(body.kode))) {
    const ra = retryAfter ? Number(retryAfter) * 1000 : null;
    return { jenis: "ulang", retryAfterMs: ra && Number.isFinite(ra) ? ra : null, pesan };
  }
  return { jenis: "tindakan", kode: body?.kode ?? String(status), pesan };
}

/* ---------- menulis ke antrean ---------- */

export async function tambahOp(
  db: DbAkun,
  kind: JenisOp,
  inspectionId: string,
  payload: Record<string, unknown>,
  now = Date.now(),
): Promise<OutboxOp> {
  const tx = db.transaction(["outbox", "meta"], "readwrite");
  const seq = (((await tx.objectStore("meta").get("seq")) as number | undefined) ?? 0) + 1;
  await tx.objectStore("meta").put(seq, "seq");
  const op = buatOp(kind, inspectionId, payload, seq, now);
  await tx.objectStore("outbox").put(op);
  await tx.done;
  return op;
}

/** Operasi baru; pemanggil yang menulis beberapa operasi dalam satu transaksi menghitung `seq` sendiri. */
export function buatOp(kind: JenisOp, inspectionId: string, payload: Record<string, unknown>, seq: number, now = Date.now()): OutboxOp {
  return {
    opId: uuidv7(now),
    kind,
    inspectionId,
    seq,
    payload,
    attempts: 0,
    nextAttemptAt: now,
    status: "pending",
    lastError: null,
    errorKode: null,
    createdAt: now,
  };
}

export async function opsInspeksi(db: DbAkun, inspectionId: string): Promise<OutboxOp[]> {
  const ops = await db.getAllFromIndex("outbox", "byInspection", inspectionId);
  return ops.sort((a, b) => a.seq - b.seq);
}

/** Jadikan semua operasi bisa dicoba sekarang ("Kirim sekarang"). Operasi perlu-tindakan ikut dicoba lagi. */
export async function majukanSemua(db: DbAkun, now = Date.now()) {
  const tx = db.transaction("outbox", "readwrite");
  for (const op of await tx.store.getAll()) {
    await tx.store.put({ ...op, nextAttemptAt: now, status: "pending" });
  }
  await tx.done;
}

/* ---------- menguras ---------- */

export type Pengirim = (op: OutboxOp, db: DbAkun) => Promise<{ status: number; body: unknown; retryAfter: string | null }>;

export type HasilKuras = { terkirim: number; gagal: number; sesiHabis: boolean; tersisa: number };

/** Pengirim HTTP sungguhan. Foto dibaca dari store `photos` saat dikirim. */
export function pengirimHttp(fetchFn: typeof fetch = fetch, base = ""): Pengirim {
  return async (op, db) => {
    const headers: Record<string, string> = { "Idempotency-Key": op.opId };
    let url: string;
    let init: RequestInit;
    const id = op.inspectionId;
    switch (op.kind) {
      case "start":
        url = `/api/inspections/start`;
        init = { method: "POST", body: JSON.stringify({ inspectionId: id, ...op.payload }), headers: { ...headers, "Content-Type": "application/json" } };
        break;
      case "finalize":
        url = `/api/inspections/${id}/finalize`;
        init = { method: "POST", body: JSON.stringify(op.payload), headers: { ...headers, "Content-Type": "application/json" } };
        break;
      case "discard":
        url = `/api/inspections/${id}`;
        init = { method: "DELETE", headers };
        break;
      case "delete-photo":
        url = `/api/inspections/${id}/photos/${op.payload.photoId}`;
        init = { method: "DELETE", headers };
        break;
      case "upload-photo": {
        const foto = await db.get("photos", op.payload.photoId as string);
        if (!foto) return { status: 200, body: { dilewati: true }, retryAfter: null }; // sudah dihapus
        url = `/api/inspections/${id}/photos/${foto.photoId}`;
        init = {
          method: "PUT",
          body: foto.blob,
          headers: {
            ...headers,
            "Content-Type": foto.contentType,
            "X-Sha256": foto.sha256,
            "X-Taken-At": foto.takenAtDevice,
            "X-Width": String(foto.width),
            "X-Height": String(foto.height),
            ...(foto.lat !== null ? { "X-Lat": String(foto.lat), "X-Lng": String(foto.lng) } : {}),
            ...(foto.akurasi != null ? { "X-Accuracy": String(foto.akurasi) } : {}),
            ...(foto.langkah ? { "X-Step": foto.langkah } : {}),
          },
        };
        break;
      }
    }
    const res = await fetchFn(base + url, { ...init, credentials: "same-origin", cache: "no-store" });
    const body = await res.json().catch(() => null);
    return { status: res.status, body, retryAfter: res.headers.get("retry-after") };
  };
}

/** Efek lokal setelah operasi diterima peladen. */
async function setelahBerhasil(db: DbAkun, op: OutboxOp, body: unknown) {
  if (op.kind === "upload-photo") {
    const f = await db.get("photos", op.payload.photoId as string);
    if (f) await db.put("photos", { ...f, uploaded: true });
  }
  if (op.kind === "finalize") {
    const hasil = body as HasilFinal;
    const draf = await db.get("drafts", op.inspectionId);
    const tx = db.transaction(["drafts", "photos", "sent", "outbox"], "readwrite");
    await tx.objectStore("sent").put({
      inspectionId: hasil.inspectionId,
      assetId: draf?.assetId ?? (op.payload.assetId as number),
      kode: hasil.kodeAset,
      inspectedAt: hasil.inspectedAt,
      kesimpulan: hasil.kesimpulan,
      jumlahTemuan: hasil.temuan.length,
      gateStatus: hasil.gateStatus,
      temuan: hasil.temuan,
      offline: hasil.offline,
    });
    // Foto dan token dihapus dari perangkat setelah finalize diterima (SPEC §7.4, §7.10).
    await tx.objectStore("drafts").delete(op.inspectionId);
    for (const k of await tx.objectStore("photos").index("byInspection").getAllKeys(op.inspectionId)) {
      await tx.objectStore("photos").delete(k);
    }
    for (const k of await tx.objectStore("outbox").index("byInspection").getAllKeys(op.inspectionId)) {
      await tx.objectStore("outbox").delete(k);
    }
    await tx.done;
  }
}

async function tandaiDrafPerluTindakan(db: DbAkun, inspectionId: string, pesan: string) {
  const d = await db.get("drafts", inspectionId);
  if (d) await db.put("drafts", { ...d, status: "perlu_tindakan", pesan, updatedAt: new Date().toISOString() });
}

/**
 * Kuras antrean sekali. Mengembalikan ringkasan. Aman dipanggil berulang; pemanggil
 * sebaiknya membungkusnya dengan kunci (navigator.locks) agar jendela dan SW tidak bersamaan.
 */
export async function kuras(
  db: DbAkun,
  kirim: Pengirim,
  opts: { now?: () => number; random?: () => number; paralel?: number } = {},
): Promise<HasilKuras> {
  const now = opts.now ?? Date.now;
  const random = opts.random ?? Math.random;
  const hasil: HasilKuras = { terkirim: 0, gagal: 0, sesiHabis: false, tersisa: 0 };

  const semua = (await db.getAll("outbox")).sort((a, b) => a.seq - b.seq);
  const kelompok = new Map<string, OutboxOp[]>();
  for (const op of semua) {
    const list = kelompok.get(op.inspectionId) ?? [];
    list.push(op);
    kelompok.set(op.inspectionId, list);
  }

  const antrian = [...kelompok.values()];
  const kerjakan = async (ops: OutboxOp[]) => {
    for (const op of ops) {
      if (hasil.sesiHabis) return;
      if (op.status === "needs_action" || op.nextAttemptAt > now()) return; // kepala macet: tahan sisanya
      let r: Awaited<ReturnType<Pengirim>>;
      try {
        r = await kirim(op, db);
      } catch (e) {
        r = { status: 0, body: { pesan: "Tidak ada sinyal." }, retryAfter: null };
        void e;
      }
      const k = r.status === 0
        ? ({ jenis: "ulang", retryAfterMs: null, pesan: "Menunggu sinyal." } as const)
        : klasifikasi(r.status, r.body as { kode?: string; pesan?: string } | null, r.retryAfter);
      if (k.jenis === "ok") {
        await db.delete("outbox", op.opId);
        await setelahBerhasil(db, op, r.body);
        hasil.terkirim++;
        continue;
      }
      hasil.gagal++;
      if (k.jenis === "sesi_habis") {
        hasil.sesiHabis = true;
        await db.put("outbox", { ...op, lastError: k.pesan, errorKode: "sesi_habis" });
        return;
      }
      if (k.jenis === "ulang") {
        const attempts = op.attempts + 1;
        await db.put("outbox", {
          ...op,
          attempts,
          nextAttemptAt: now() + jedaBackoff(attempts, random, k.retryAfterMs),
          lastError: k.pesan,
          errorKode: null,
        });
        return;
      }
      await db.put("outbox", { ...op, status: "needs_action", lastError: k.pesan, errorKode: k.kode });
      await tandaiDrafPerluTindakan(db, op.inspectionId, k.pesan);
      return;
    }
  };

  const jalan = Array.from({ length: Math.min(opts.paralel ?? PARALEL, antrian.length) }, async () => {
    for (let ops = antrian.shift(); ops; ops = antrian.shift()) await kerjakan(ops);
  });
  await Promise.all(jalan);

  hasil.tersisa = await db.count("outbox");
  await setMeta(db, "lastSyncAt", new Date(now()).toISOString());
  return hasil;
}

/** Waktu percobaan berikutnya paling awal (untuk menyetel pengatur waktu), atau null. */
export async function percobaanBerikutnya(db: DbAkun): Promise<number | null> {
  const ops = await db.getAll("outbox");
  const t = ops.filter((o) => o.status === "pending").map((o) => o.nextAttemptAt);
  return t.length ? Math.min(...t) : null;
}

export { getMeta };
