"use client";

/**
 * Kartu Lokasi pada formulir inspeksi (PRD "Aturan gerbang lokasi", ADR-7).
 * - Posisi diikuti selama formulir terbuka; bacaan TERAKHIR yang dipakai saat Kirim.
 * - Tanpa posisi sama sekali (lokasi mati / izin ditolak): inspeksi diblokir, dengan ajakan
 *   menyalakan lokasi dan tombol Coba lagi. Objek bergerak tidak pernah diblokir.
 * - Pratinjau gerbang memakai fungsi yang sama dengan peladen (`nilaiGerbang`); keputusan
 *   resmi tetap di peladen.
 */
import { CircleCheck, Crosshair, LocateOff, MapPin, MapPinX, TriangleAlert, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatWaktu } from "@/lib/format";
import { labelAkurasi, labelJarak } from "@/lib/geo/akurasi";
import {
  LANGKAH_LOKASI_ANDROID,
  nilaiGerbang,
  PESAN_LOKASI_MATI,
  pesanDitolak,
  pesanPerluTinjauan,
  pesanSinyalLemah,
  type HasilGerbang,
} from "@/lib/geo/gerbang";
import { cn } from "@/lib/utils";
import { simpanGps } from "../client/aksi";
import type { AsetPaket, DrafLokal, PaketKerja } from "../client/types";
import { useInspektur } from "./konteks";
import { LencanaGerbang } from "./lencana";

export type StatusGps = "mencari" | "ada" | "ditolak" | "gagal" | "tidak_didukung";

export type KeadaanLokasi = {
  /** false = Kirim dinonaktifkan (lokasi mati / izin ditolak / belum ada posisi / di luar galangan). */
  bolehKirim: boolean;
  /** Alasan Kirim dinonaktifkan, ditampilkan di bawah tombol Kirim; null bila boleh kirim. */
  alasanTidakKirim: string | null;
  /** Akurasi bacaan terakhir lemah: tampilkan pilihan Tunggu / Kirim sekarang. */
  lemah: boolean;
  gerbang: HasilGerbang;
  ambilUlang: () => void;
};

/** Pratinjau gerbang dari paket kerja (luring juga). */
export function pratinjauGerbang(paket: PaketKerja, aset: AsetPaket, gps: DrafLokal["gps"]): HasilGerbang {
  const g = paket.gerbang;
  const areaAset = aset.areaId != null && g?.area[aset.areaId] ? { id: aset.areaId, ...g.area[aset.areaId]! } : null;
  return nilaiGerbang({
    posisi: gps ? { lat: gps.lat, lng: gps.lng, akurasi: gps.accuracy } : null,
    areaAset,
    kawasan: g?.kawasan ?? null,
    bergerak: !!aset.bergerak,
    pengaturan: g?.pengaturan ?? { toleransiGedungM: 30, toleransiKawasanM: 50, akurasiLemahM: 100 },
    areaLain: g ? Object.entries(g.area).map(([id, a]) => ({ id: Number(id), ...a })) : [],
  });
}

/** Mengikuti posisi selama formulir terbuka. Mengembalikan status dan fungsi coba lagi. */
export function useLokasi(draf: DrafLokal, aktif: boolean, berubah: () => void) {
  const { db } = useInspektur();
  const [status, setStatus] = useState<StatusGps>(draf.gps ? "ada" : "mencari");
  const watch = useRef<number | null>(null);

  const mulai = useCallback(() => {
    if (!("geolocation" in navigator)) return setStatus("tidak_didukung");
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    setStatus((s) => (s === "ada" ? s : "mencari"));
    watch.current = navigator.geolocation.watchPosition(
      async (p) => {
        await simpanGps(
          db!,
          draf.inspectionId,
          {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: Math.round(p.coords.accuracy),
            capturedAt: new Date(p.timestamp || Date.now()).toISOString(),
          },
          true, // bacaan terakhir yang dipakai (PRD)
        );
        setStatus("ada");
        berubah();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
          watch.current = null;
          setStatus("ditolak");
        } else setStatus((s) => (s === "ada" ? s : "gagal"));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, [db, draf.inspectionId, berubah]);

  useEffect(() => {
    if (!aktif) return;
    const t = setTimeout(mulai, 0);
    return () => {
      clearTimeout(t);
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
    // sekali saat formulir dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif]);

  return { status, mulai };
}

export function useKeadaanLokasi(paket: PaketKerja, aset: AsetPaket, draf: DrafLokal, bisaUbah: boolean, berubah: () => void) {
  const { status, mulai } = useLokasi(draf, bisaUbah, berubah);
  const gerbang = useMemo(() => pratinjauGerbang(paket, aset, draf.gps), [paket, aset, draf.gps]);
  // Objek bergerak tidak pernah diblokir. Di luar galangan: peladen pasti menolak (422), jadi Kirim
  // dinonaktifkan di sini juga, termasuk saat luring (pratinjau dari paket kerja), dengan alasannya.
  const alasanTidakKirim = aset.bergerak
    ? null
    : !draf.gps
      ? "Lokasi belum diperoleh. Nyalakan Lokasi (GPS), lalu tekan Coba lagi."
      : gerbang.hasil === "ditolak"
        ? "Tidak bisa dikirim: posisi Anda di luar kawasan galangan. Pergi ke lokasi aset, lalu tekan Ambil ulang posisi."
        : null;
  const keadaan: KeadaanLokasi = {
    bolehKirim: alasanTidakKirim === null,
    alasanTidakKirim,
    lemah: gerbang.alasan === "gps_lemah",
    gerbang,
    ambilUlang: mulai,
  };
  return { status, keadaan };
}

function pesanPratinjau(g: HasilGerbang, aset: AsetPaket, paket: PaketKerja): string {
  const namaArea = aset.areaId != null ? (paket.gerbang?.area[aset.areaId]?.nama ?? null) : null;
  if (g.hasil === "ditolak") return pesanDitolak(g.jarakKeKawasanM);
  if (g.status === "sesuai") {
    if (!namaArea) return "Lokasi sesuai.";
    // Masuk berkat kelonggaran akurasi: titik di luar poligon, tetapi dalam toleransi.
    return g.jarakKeAreaM ? `Posisi Anda di dekat ${namaArea} (dalam toleransi).` : `Posisi Anda di ${namaArea}.`;
  }
  if (g.alasan === "gps_lemah") return pesanSinyalLemah(g.akurasiM ?? 999);
  if (g.alasan === "di_luar_gedung") return pesanPerluTinjauan(namaArea);
  return "";
}

type Vonis = { nada: "ok" | "warn" | "bad" | "mut"; Ikon: typeof Crosshair; judul: string };

function vonis(g: HasilGerbang, aset: AsetPaket, terblokir: boolean, adaGps: boolean): Vonis {
  if (aset.bergerak) return { nada: "mut", Ikon: Truck, judul: "Objek bergerak" };
  if (terblokir) return { nada: "bad", Ikon: LocateOff, judul: "Lokasi mati" };
  if (!adaGps) return { nada: "mut", Ikon: Crosshair, judul: "Mencari posisi" };
  if (g.hasil === "ditolak") return { nada: "bad", Ikon: MapPinX, judul: "Di luar galangan" };
  if (g.status === "sesuai") return { nada: "ok", Ikon: CircleCheck, judul: "Lokasi sesuai" };
  if (g.alasan === "gps_lemah") return { nada: "warn", Ikon: TriangleAlert, judul: "Perlu tinjauan: GPS lemah" };
  return { nada: "warn", Ikon: MapPin, judul: "Perlu tinjauan: di luar gedung" };
}

const WARNA_VONIS: Record<Vonis["nada"], string> = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  bad: "bg-danger-soft text-danger",
  mut: "bg-muted text-muted-foreground",
};

/**
 * Hasil gerbang lokasi di formulir (arah A): ikon dan judul keputusan, pesan yang sama dengan
 * peladen, akurasi dan jarak, lalu aksi Coba lagi / Ambil ulang posisi.
 */
export function KartuLokasi({
  aset,
  paket,
  draf,
  status,
  keadaan,
  bisaUbah,
}: {
  aset: AsetPaket;
  paket: PaketKerja;
  draf: DrafLokal;
  status: StatusGps;
  keadaan: KeadaanLokasi;
  bisaUbah: boolean;
}) {
  const g = keadaan.gerbang;
  const terblokir = !keadaan.bolehKirim && (status === "ditolak" || status === "gagal" || status === "tidak_didukung");
  const terbatas = !!aset.areaTerbatas;
  const v = vonis(g, aset, terblokir, !!draf.gps);
  const namaArea = aset.areaId != null ? (paket.gerbang?.area[aset.areaId]?.nama ?? null) : null;

  return (
    <section
      aria-label="Lokasi"
      className={cn(
        "space-y-3 rounded-[var(--a-radius-kartu,16px)] border bg-card p-4 transition-colors duration-300",
        v.nada === "bad" ? "border-danger/40" : "border-border/80",
      )}
      data-testid="kartu-lokasi"
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-[var(--a-radius-kontrol,10px)]", WARNA_VONIS[v.nada])}>
          <v.Ikon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Lokasi</p>
            {aset.bergerak ? <LencanaGerbang status="tidak_berlaku" /> : g.status && !terblokir && draf.gps ? <LencanaGerbang status={g.status} /> : null}
          </div>
          <p className="text-lg leading-snug font-bold">{v.judul}</p>
        </div>
      </div>

      {aset.bergerak ? (
        <p className="text-sm text-muted-foreground" data-testid="pesan-gps">
          Objek bergerak: lokasi tidak diperiksa. Posisi tetap direkam sebagai informasi.
        </p>
      ) : terblokir ? (
        <div className="space-y-3" role="alert" data-testid="lokasi-mati">
          <p className="text-sm font-medium text-danger" data-testid="pesan-gps">
            {status === "tidak_didukung" ? "Perangkat ini tidak mendukung lokasi. Inspeksi tidak dapat dikirim dari perangkat ini." : PESAN_LOKASI_MATI}
          </p>
          {status !== "tidak_didukung" && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {LANGKAH_LOKASI_ANDROID.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          )}
        </div>
      ) : !draf.gps ? (
        <p className="text-sm text-muted-foreground" data-testid="pesan-gps">
          Mencari posisi…
        </p>
      ) : (
        <p className={cn("text-sm", g.hasil === "ditolak" ? "text-danger" : "text-foreground/85")} data-testid="pesan-gps">
          {pesanPratinjau(g, aset, paket)}
        </p>
      )}

      {terbatas && !aset.bergerak && (
        <p className="rounded-[var(--a-radius-kontrol,10px)] bg-info-soft px-3 py-2 text-sm text-info">Area terbatas: inspeksi ini akan ditinjau.</p>
      )}

      {draf.gps && !aset.bergerak && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {namaArea && (
            <>
              <dt className="text-muted-foreground">Area aset</dt>
              <dd className="font-medium">{namaArea}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Akurasi</dt>
          <dd className="font-medium tabular-nums">
            {labelAkurasi(draf.gps.accuracy)} · {formatWaktu(draf.gps.capturedAt)}
          </dd>
          {g.jarakKeAreaM !== null && g.jarakKeAreaM > 0 && (
            <>
              <dt className="text-muted-foreground">Jarak ke area</dt>
              <dd className="font-medium tabular-nums">{labelJarak(g.jarakKeAreaM)}</dd>
            </>
          )}
        </dl>
      )}
      {draf.gps && aset.bergerak && (
        <p className="text-xs text-muted-foreground">
          Akurasi {labelAkurasi(draf.gps.accuracy)} · {formatWaktu(draf.gps.capturedAt)}
        </p>
      )}

      {bisaUbah && (status !== "tidak_didukung" || aset.bergerak) && (
        <Button
          variant={terblokir ? "brand" : "outline"}
          className={cn("h-11", terblokir && "w-full")}
          onClick={keadaan.ambilUlang}
          disabled={status === "mencari" && !draf.gps}
          data-testid="coba-lagi-lokasi"
        >
          <Crosshair className="size-4" aria-hidden /> {terblokir ? "Coba lagi" : "Ambil ulang posisi"}
        </Button>
      )}
    </section>
  );
}
