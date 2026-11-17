"use client";

/**
 * Kartu Lokasi pada formulir inspeksi (PRD "Aturan gerbang lokasi", ADR-7).
 * - Posisi diikuti selama formulir terbuka; bacaan TERAKHIR yang dipakai saat Kirim.
 * - Tanpa posisi sama sekali (lokasi mati / izin ditolak): inspeksi diblokir, dengan ajakan
 *   menyalakan lokasi dan tombol Coba lagi. Objek bergerak tidak pernah diblokir.
 * - Pratinjau gerbang memakai fungsi yang sama dengan peladen (`nilaiGerbang`); keputusan
 *   resmi tetap di peladen.
 */
import { Crosshair, LocateOff, SignalLow } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatWaktu } from "@/lib/format";
import { labelAkurasi } from "@/lib/geo/akurasi";
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
  /** false = Kirim dinonaktifkan (lokasi mati / izin ditolak / belum ada posisi). */
  bolehKirim: boolean;
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
  const keadaan: KeadaanLokasi = {
    bolehKirim: !!aset.bergerak || !!draf.gps,
    lemah: gerbang.alasan === "gps_lemah",
    gerbang,
    ambilUlang: mulai,
  };
  return { status, keadaan };
}

function pesanPratinjau(g: HasilGerbang, aset: AsetPaket, paket: PaketKerja): string {
  const namaArea = aset.areaId != null ? (paket.gerbang?.area[aset.areaId]?.nama ?? null) : null;
  if (g.hasil === "ditolak") return pesanDitolak(g.jarakKeKawasanM);
  if (g.status === "sesuai") return namaArea ? `Posisi Anda di ${namaArea}.` : "Lokasi sesuai.";
  if (g.alasan === "gps_lemah") return pesanSinyalLemah(g.akurasiM ?? 999);
  if (g.alasan === "di_luar_gedung") return pesanPerluTinjauan(namaArea);
  return "";
}

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

  return (
    <Card className={cn("gap-0 py-0 transition-colors duration-300", terblokir && "border-danger/40")} data-testid="kartu-lokasi">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Lokasi</p>
          {aset.bergerak ? (
            <LencanaGerbang status="tidak_berlaku" />
          ) : g.hasil === "ditolak" ? (
            <span className="inline-flex items-center rounded-md bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Di luar galangan</span>
          ) : (
            g.status && <LencanaGerbang status={g.status} />
          )}
        </div>

        {aset.bergerak ? (
          <p className="text-sm text-muted-foreground" data-testid="pesan-gps">
            Objek bergerak: lokasi tidak diperiksa. Posisi tetap direkam sebagai informasi.
          </p>
        ) : terblokir ? (
          <div className="space-y-3" role="alert" data-testid="lokasi-mati">
            <p className="flex gap-2 text-sm font-medium text-danger" data-testid="pesan-gps">
              <LocateOff className="mt-0.5 size-4 shrink-0" aria-hidden />
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
          <p
            className={cn("flex gap-2 text-sm", g.hasil === "ditolak" ? "text-danger" : "text-muted-foreground")}
            data-testid="pesan-gps"
          >
            {keadaan.lemah && <SignalLow className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {pesanPratinjau(g, aset, paket)}
          </p>
        )}

        {terbatas && !aset.bergerak && (
          <p className="text-xs text-muted-foreground">Area terbatas: inspeksi ini akan ditinjau.</p>
        )}

        {draf.gps && (
          <p className="text-xs text-muted-foreground">
            Akurasi {labelAkurasi(draf.gps.accuracy)} · {formatWaktu(draf.gps.capturedAt)}
          </p>
        )}

        {bisaUbah && (status !== "tidak_didukung" || aset.bergerak) && (
          <Button
            variant="outline"
            size="sm"
            onClick={keadaan.ambilUlang}
            disabled={status === "mencari" && !draf.gps}
            data-testid="coba-lagi-lokasi"
          >
            <Crosshair className="size-3.5" aria-hidden /> {terblokir ? "Coba lagi" : "Ambil ulang posisi"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
