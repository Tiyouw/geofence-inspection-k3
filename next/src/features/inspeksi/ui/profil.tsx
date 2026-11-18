"use client";

import { Camera, MapPin, RefreshCw, Share, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IlustrasiModul, LABEL_MODUL_ILUSTRASI, modulDari, type ModulIlustrasi } from "@/components/ilustrasi/modul";
import { Button } from "@/components/ui/button";
import { formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { segarkanPaket } from "../client/aksi";
import { formatUkuran, useRuang } from "./antrean";
import { Cip, JudulBagian, Kartu } from "./a";
import { useInspektur } from "./konteks";
import { useKeadaanPasang } from "./pasang-aplikasi";
import { TombolKeluar } from "./status-bar";

type Izin = "granted" | "denied" | "prompt" | "tidak-diketahui";

function useIzin(nama: "camera" | "geolocation"): Izin {
  const [s, setS] = useState<Izin>("tidak-diketahui");
  useEffect(() => {
    let st: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: nama as PermissionName })
      .then((r) => {
        st = r;
        setS(r.state);
        r.onchange = () => setS(r.state);
      })
      .catch(() => {});
    return () => {
      if (st) st.onchange = null;
    };
  }, [nama]);
  return s;
}

function CipIzin({ s }: { s: Izin }) {
  if (s === "granted") return <Cip nada="ok">Diizinkan</Cip>;
  if (s === "denied") return <Cip nada="bad">Ditolak</Cip>;
  if (s === "prompt") return <Cip nada="warn">Ditanya saat dipakai</Cip>;
  return <Cip>Belum diketahui</Cip>;
}

export function Profil({ nama, nip, jabatan }: { nama: string; nip: string; jabatan: string | null }) {
  const { db, data, daring, berubah } = useInspektur();
  const [segar, setSegar] = useState(false);
  const ruang = useRuang();
  const kamera = useIzin("camera");
  const lokasi = useIzin("geolocation");
  const pasang = useKeadaanPasang();
  const modul = useMemo(() => {
    const m = new Set<ModulIlustrasi>();
    for (const a of data.paket?.aset ?? []) m.add(modulDari(a.slug ?? a.tipe));
    return [...m];
  }, [data.paket]);
  const inisial = nama
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Profil</h1>

      <Kartu className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden>
          {inisial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{nama}</p>
          <p className="text-sm text-muted-foreground">
            Inspektur{data.paket?.unit ? ` · ${data.paket.unit}` : ""}
            {jabatan ? ` · ${jabatan}` : ""}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">NIP {nip}</p>
        </div>
      </Kartu>

      {modul.length > 0 && (
        <section className="space-y-2" aria-label="Modul unit saya">
          <JudulBagian judul="Modul unit saya" />
          <Kartu className="flex flex-wrap gap-4">
            {modul.map((m) => (
              <span key={m} className="flex w-20 flex-col items-center gap-1 text-center text-xs font-medium">
                <IlustrasiModul modul={m} ukuran={56} />
                {LABEL_MODUL_ILUSTRASI[m]}
              </span>
            ))}
          </Kartu>
        </section>
      )}

      <section className="space-y-2" aria-label="Perangkat">
        <JudulBagian judul="Perangkat" />
        <Kartu className="divide-y divide-border/70 py-1 text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="block text-muted-foreground">Data stiker</span>
              <b>{data.paketDiperbarui ? `diperbarui ${formatWaktu(data.paketDiperbarui)}` : "belum diunduh"}</b>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!daring || segar || !db}
              onClick={async () => {
                setSegar(true);
                await segarkanPaket(db!).finally(() => setSegar(false));
                berubah();
              }}
            >
              <RefreshCw className={cn("size-4", segar && "animate-spin")} aria-hidden /> Perbarui
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Camera className="size-4" aria-hidden /> Izin kamera
            </span>
            <CipIzin s={kamera} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" aria-hidden /> Izin lokasi
            </span>
            <CipIzin s={lokasi} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-muted-foreground">Penyimpanan</span>
            <b className="tabular-nums">
              {ruang ? `${formatUkuran(ruang.pakai)} dipakai · ${formatUkuran(Math.max(0, ruang.kuota - ruang.pakai))} bebas` : "—"}
            </b>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="size-4" aria-hidden /> Layar utama
            </span>
            {pasang.sudah ? (
              <Cip nada="ok">Terpasang</Cip>
            ) : pasang.bisaPrompt ? (
              <Button size="sm" variant="outline" onClick={() => void pasang.pasang()}>
                Pasang aplikasi
              </Button>
            ) : pasang.ios ? (
              <span className="text-right text-xs text-muted-foreground">
                <Share className="inline size-3.5 align-text-bottom" aria-label="Bagikan" /> lalu Tambah ke Layar Utama
              </span>
            ) : (
              <Cip>Lewat menu peramban</Cip>
            )}
          </div>
        </Kartu>
      </section>

      <TombolKeluar />
      <p className="text-center text-xs text-muted-foreground">Keluar menghapus data aplikasi dari ponsel ini.</p>
    </div>
  );
}
