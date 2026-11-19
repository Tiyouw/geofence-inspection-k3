/**
 * IndexedDB per akun: `pal-k3:{userId}` (SPEC §7.2, §7.8 baris terakhir).
 * Dipakai jendela dan service worker; jangan mengimpor apa pun yang khusus DOM di sini.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DrafLokal, FotoLokal, OutboxOp, PaketKerja, Terkirim } from "./types";

export type MetaNilai = {
  paket: PaketKerja;
  paketDiperbarui: string;
  hmacKey: CryptoKey;
  serverClockOffsetMs: number;
  seq: number;
  lastSyncAt: string;
};

interface Skema extends DBSchema {
  meta: { key: string; value: unknown };
  drafts: { key: string; value: DrafLokal; indexes: { byAsset: number } };
  photos: { key: string; value: FotoLokal; indexes: { byInspection: string } };
  outbox: { key: string; value: OutboxOp; indexes: { byInspection: string; bySeq: number } };
  sent: { key: string; value: Terkirim };
}

export type DbAkun = IDBPDatabase<Skema>;

const cache = new Map<number, Promise<DbAkun>>();

export function namaDb(userId: number): string {
  return `pal-k3:${userId}`;
}

export function bukaDb(userId: number): Promise<DbAkun> {
  let p = cache.get(userId);
  if (!p) {
    p = openDB<Skema>(namaDb(userId), 1, {
      /**
       * Konteks lain (tab lain, atau jendela saat keluar) ingin menghapus basis data ini: tutup
       * koneksi ini dan lupakan dari cache. Tanpa ini koneksi service worker yang terbuka selamanya
       * membuat deleteDB tertahan, dan inspektur tidak bisa keluar (bug 19 Nov 2026).
       */
      blocking() {
        void p?.then((db) => db.close());
        if (cache.get(userId) === p) cache.delete(userId);
      },
      upgrade(db) {
        db.createObjectStore("meta");
        db.createObjectStore("drafts", { keyPath: "inspectionId" }).createIndex("byAsset", "assetId");
        db.createObjectStore("photos", { keyPath: "photoId" }).createIndex("byInspection", "inspectionId");
        const ob = db.createObjectStore("outbox", { keyPath: "opId" });
        ob.createIndex("byInspection", "inspectionId");
        ob.createIndex("bySeq", "seq");
        db.createObjectStore("sent", { keyPath: "inspectionId" });
      },
    });
    cache.set(userId, p);
  }
  return p;
}

export async function tutupDb(userId: number) {
  const p = cache.get(userId);
  cache.delete(userId);
  if (p) (await p).close();
}

export async function getMeta<K extends keyof MetaNilai>(db: DbAkun, k: K): Promise<MetaNilai[K] | undefined> {
  return (await db.get("meta", k)) as MetaNilai[K] | undefined;
}

export async function setMeta<K extends keyof MetaNilai>(db: DbAkun, k: K, v: MetaNilai[K]) {
  await db.put("meta", v, k);
}

/* Basis data global kecil: siapa yang sedang masuk, supaya service worker tahu antrean mana yang dikuras. */
interface SkemaGlobal extends DBSchema {
  kv: { key: string; value: unknown };
}

export function bukaGlobal() {
  return openDB<SkemaGlobal>("pal-k3", 1, {
    upgrade(db) {
      db.createObjectStore("kv");
    },
  });
}

export async function setPenggunaAktif(userId: number | null) {
  const g = await bukaGlobal();
  if (userId === null) await g.delete("kv", "userId");
  else await g.put("kv", userId, "userId");
  g.close();
}

export async function getPenggunaAktif(): Promise<number | null> {
  const g = await bukaGlobal();
  const v = (await g.get("kv", "userId")) as number | undefined;
  g.close();
  return v ?? null;
}
