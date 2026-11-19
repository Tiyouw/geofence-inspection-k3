"use client";

import { deleteDB } from "idb";
import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { bukaDb, getMeta, namaDb, setPenggunaAktif, tutupDb, type DbAkun } from "../client/db";
import { segarkanPaket, sinkronJam } from "../client/aksi";
import { KANAL, kurasSekarang, pasangPemicu, umumkan } from "../client/sinkron";
import type { DrafLokal, OutboxOp, PaketKerja, Terkirim } from "../client/types";

export type DataLokal = {
  paket: PaketKerja | null;
  paketDiperbarui: string | null;
  drafts: DrafLokal[];
  ops: OutboxOp[];
  sent: Terkirim[];
  fotoPerInspeksi: Record<string, { total: number; terunggah: number }>;
};

type Konteks = {
  userId: number;
  db: DbAkun | null;
  daring: boolean;
  data: DataLokal;
  siap: boolean;
  /** Baca ulang IndexedDB dan beri tahu tab lain. */
  berubah: () => void;
  kirimSekarang: () => Promise<void>;
};

const Ctx = createContext<Konteks | null>(null);

export function useInspektur(): Konteks {
  const c = use(Ctx);
  if (!c) throw new Error("useInspektur harus di dalam PetugasProvider");
  return c;
}

/** Jarak minimum penyegaran paket kerja saat berpindah halaman lapangan. */
const SEGARKAN_PAKET_MS = 2 * 60_000;

const KOSONG: DataLokal = { paket: null, paketDiperbarui: null, drafts: [], ops: [], sent: [], fotoPerInspeksi: {} };

async function bacaSemua(db: DbAkun): Promise<DataLokal> {
  const [paket, paketDiperbarui, drafts, ops, sent, fotos] = await Promise.all([
    getMeta(db, "paket"),
    getMeta(db, "paketDiperbarui"),
    db.getAll("drafts"),
    db.getAll("outbox"),
    db.getAll("sent"),
    db.getAll("photos"),
  ]);
  const fotoPerInspeksi: DataLokal["fotoPerInspeksi"] = {};
  for (const f of fotos) {
    if (f.sesi) continue; // jepretan kamera yang belum disimpan bukan bagian antrean
    const x = (fotoPerInspeksi[f.inspectionId] ??= { total: 0, terunggah: 0 });
    x.total++;
    if (f.uploaded) x.terunggah++;
  }
  // Paket lama (yang terakhir diunduh) bisa memuat terkirim dari peladen; gabungkan dengan lokal.
  const gabung = new Map<string, Terkirim>();
  for (const t of paket?.terkirim ?? []) gabung.set(t.inspectionId, t);
  for (const t of sent) gabung.set(t.inspectionId, t);
  const batas = Date.now() - 30 * 86_400_000;
  return {
    paket: paket ?? null,
    paketDiperbarui: paketDiperbarui ?? null,
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ops: ops.sort((a, b) => a.seq - b.seq),
    sent: [...gabung.values()]
      .filter((t) => new Date(t.inspectedAt).getTime() >= batas)
      .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt)),
    fotoPerInspeksi,
  };
}

export function PetugasProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const [db, setDb] = useState<DbAkun | null>(null);
  const [data, setData] = useState<DataLokal>(KOSONG);
  const [siap, setSiap] = useState(false);
  const daring = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const dbRef = useRef<DbAkun | null>(null);

  const baca = useCallback(async () => {
    if (!dbRef.current) return;
    setData(await bacaSemua(dbRef.current));
  }, []);

  const berubah = useCallback(() => {
    void baca();
    umumkan({ jenis: "berubah" });
    void kurasSekarang(userId).then(() => baca());
  }, [baca, userId]);

  useEffect(() => {
    let lepas: (() => void) | undefined;
    let hidup = true;
    (async () => {
      const d = await bukaDb(userId);
      if (!hidup) return;
      dbRef.current = d;
      setDb(d);
      await setPenggunaAktif(userId);
      await baca();
      setSiap(true);
      if (navigator.onLine) {
        await Promise.all([segarkanPaket(d), sinkronJam(d)]);
        await baca();
        navigator.serviceWorker?.controller?.postMessage({ jenis: "hangatkan" });
      }
      lepas = pasangPemicu(userId);
      navigator.storage?.persist?.().catch(() => {});
    })();
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(KANAL) : null;
    if (bc) bc.onmessage = () => void baca();
    const naik = async () => {
      if (dbRef.current) {
        await Promise.all([segarkanPaket(dbRef.current), sinkronJam(dbRef.current)]);
        void baca();
      }
    };
    window.addEventListener("online", naik);
    return () => {
      hidup = false;
      lepas?.();
      bc?.close();
      window.removeEventListener("online", naik);
    };
  }, [userId, baca]);

  // Menu lapangan kini memakai navigasi klien, jadi efek di atas tidak berjalan lagi di tiap ketukan.
  // Paket kerja tetap disegarkan saat berpindah halaman bila sudah lebih dari SEGARKAN_PAKET_MS.
  const pathname = usePathname();
  const terakhirSegar = useRef(0);
  useEffect(() => {
    // Render pertama: paket baru saja disegarkan oleh efek pemasangan.
    if (!terakhirSegar.current) {
      terakhirSegar.current = Date.now();
      return;
    }
    const d = dbRef.current;
    if (!d || !navigator.onLine || Date.now() - terakhirSegar.current < SEGARKAN_PAKET_MS) return;
    terakhirSegar.current = Date.now();
    void segarkanPaket(d).then(() => baca());
  }, [pathname, baca]);

  // Lencana ikon aplikasi: jumlah inspeksi yang belum diterima peladen (SPEC §7.9).
  const antre = data.drafts.filter((d) => d.status !== "draf").length;
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (antre > 0) nav.setAppBadge?.(antre).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [antre]);

  const kirimSekarang = useCallback(async () => {
    if (!dbRef.current) return;
    const { majukanSemua } = await import("../client/outbox");
    await majukanSemua(dbRef.current);
    await kurasSekarang(userId);
    await baca();
  }, [userId, baca]);

  const nilai = useMemo(() => ({ userId, db, daring, data, siap, berubah, kirimSekarang }), [userId, db, daring, data, siap, berubah, kirimSekarang]);
  return <Ctx value={nilai}>{children}</Ctx>;
}

/** SPEC §7.10: keluar mengosongkan basis data akun, salinan halaman, dan kunci HMAC. */
export async function bersihkanPerangkat(userId: number) {
  await tutupDb(userId);
  await deleteDB(namaDb(userId)).catch(() => {});
  await setPenggunaAktif(null).catch(() => {});
  navigator.serviceWorker?.controller?.postMessage({ jenis: "bersihkan" });
}
