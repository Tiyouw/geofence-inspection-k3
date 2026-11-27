"use client";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { Camera, Check, RotateCcw, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAKS_JEPRETAN_LANGKAH, type LangkahFoto } from "@/lib/domain/langkah-foto";
import { cn } from "@/lib/utils";
import { hapusFotoLokal } from "../client/aksi";
import type { DrafLokal, FotoLokal } from "../client/types";
import { KameraTerpandu } from "./kamera-terpandu";
import { useInspektur } from "./konteks";

function useFotoTersimpan(inspectionId: string, versi: unknown) {
  const { db } = useInspektur();
  const [fotos, setFotos] = useState<(FotoLokal & { url: string })[]>([]);
  useEffect(() => {
    if (!db) return;
    let urls: string[] = [];
    let hidup = true;
    void db.getAllFromIndex("photos", "byInspection", inspectionId).then((list) => {
      if (!hidup) return;
      const x = list
        .sort((a, b) => a.takenAtDevice.localeCompare(b.takenAtDevice))
        .map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }));
      urls = x.map((f) => f.url);
      setFotos(x);
    });
    return () => {
      hidup = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [db, inspectionId, versi]);
  return fotos;
}

/**
 * Bagian foto bukti di formulir (PRD "Aturan bukti" 3-4): daftar langkah kamera terpandu dengan
 * jumlah foto per langkah, tombol mulai/lanjutkan kamera, dan foto ulang per langkah.
 * Tidak ada pilih berkas atau galeri. Aset di area terbatas tidak difoto.
 */
export function BuktiFoto({
  draf,
  langkah,
  labelButir,
  areaTerbatas,
  bisaUbah,
}: {
  draf: DrafLokal;
  langkah: LangkahFoto[];
  labelButir: Record<number, string>;
  areaTerbatas: boolean;
  bisaUbah: boolean;
}) {
  const { db, data, berubah } = useInspektur();
  const [versi, setVersi] = useState(0);
  const fotos = useFotoTersimpan(draf.inspectionId, `${data.fotoPerInspeksi[draf.inspectionId]?.total}-${versi}`);
  const [kamera, setKamera] = useState<number | null>(null);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();

  if (areaTerbatas) {
    return (
      <section className="space-y-2 rounded-[var(--a-radius-kartu,16px)] bg-info-soft p-4" aria-label="Foto bukti" data-testid="area-terbatas">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldOff className="size-4" aria-hidden /> Area terbatas (tanpa foto)
        </p>
        <p className="text-sm text-muted-foreground">
          Aset ini berada di area yang melarang foto. QR dan GPS sudah cukup sebagai bukti. Inspeksi otomatis ditandai dan ditinjau
          Administrator K3 atau Pemantau.
        </p>
      </section>
    );
  }

  const tersimpan = fotos.filter((f) => !f.sesi);
  const adaSesi = fotos.some((f) => f.sesi);
  const perLangkah = (kode: string) => tersimpan.filter((f) => f.langkah === kode);
  const tanpaLangkah = tersimpan.filter((f) => !f.langkah || !langkah.some((l) => l.kode === f.langkah));
  const lengkap = langkah.filter((l) => perLangkah(l.kode).length > 0).length;
  const pertamaKosong = Math.max(0, langkah.findIndex((l) => perLangkah(l.kode).length === 0));

  const hapus = async (photoId: string) => {
    if (!(await konfirmasi({ judul: "Hapus foto ini?", isi: "Foto dihapus dari draf. Langkahnya perlu difoto ulang sebelum dikirim.", tombol: "Hapus foto", bahaya: true })))
      return;
    await hapusFotoLokal(db!, draf.inspectionId, photoId);
    setVersi((v) => v + 1);
    berubah();
  };

  return (
    <section className="space-y-3" aria-label="Foto bukti">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Foto bukti</h2>
        <p className="text-xs text-muted-foreground" data-testid="progres-foto">
          {lengkap}/{langkah.length} langkah
        </p>
      </div>

      {bisaUbah && (
        <Button
          size="lg"
          className="h-14 w-full rounded-[var(--a-radius-kontrol,10px)] text-base font-bold"
          data-testid="buka-kamera"
          onClick={() => setKamera(adaSesi || lengkap < langkah.length ? pertamaKosong : 0)}
        >
          <Camera aria-hidden />
          {adaSesi ? "Lanjutkan kamera (foto belum disimpan)" : lengkap === 0 ? "Mulai kamera terpandu" : lengkap < langkah.length ? "Lanjutkan kamera terpandu" : "Buka kamera terpandu"}
        </Button>
      )}

      <ol className="space-y-2">
        {langkah.map((l, i) => {
          const f = perLangkah(l.kode);
          return (
            <li key={l.kode} className="rounded-[var(--a-radius-kartu,16px)] border border-border/80 bg-card p-3.5" data-testid={`langkah-${l.kode}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {i + 1}. {l.judul}
                  </p>
                  <p className={cn("flex items-center gap-1 text-xs", f.length ? "text-success" : "text-muted-foreground")}>
                    {f.length ? (
                      <>
                        <Check className="size-3" aria-hidden /> {f.length}/{MAKS_JEPRETAN_LANGKAH} foto
                      </>
                    ) : (
                      "Belum ada foto"
                    )}
                  </p>
                </div>
                {bisaUbah && f.length > 0 && (
                  <Button variant="outline" className="h-11" onClick={() => setKamera(i)} aria-label={`Foto ulang ${l.judul}`}>
                    <RotateCcw aria-hidden /> Foto ulang
                  </Button>
                )}
              </div>
              {f.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {f.map((x) => (
                    <Miniatur key={x.photoId} foto={x} alt={`Foto ${l.judul}`} bisaHapus={bisaUbah} onHapus={() => void hapus(x.photoId)} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {tanpaLangkah.length > 0 && (
        <div className="space-y-2 rounded-[var(--a-radius-kartu,16px)] border border-dashed p-3">
          <p className="text-sm font-medium">Foto tanpa langkah</p>
          <p className="text-xs text-muted-foreground">Diambil sebelum kamera terpandu. Hapus, lalu ambil ulang per langkah.</p>
          <div className="flex gap-2 overflow-x-auto">
            {tanpaLangkah.map((x) => (
              <Miniatur key={x.photoId} foto={x} alt="Foto tanpa langkah" bisaHapus={bisaUbah} onHapus={() => void hapus(x.photoId)} />
            ))}
          </div>
        </div>
      )}

      {kamera !== null && (
        <KameraTerpandu
          inspectionId={draf.inspectionId}
          langkah={langkah}
          labelButir={labelButir}
          mulaiDari={kamera}
          gpsDraf={draf.gps}
          onTutup={() => {
            setKamera(null);
            setVersi((v) => v + 1);
          }}
        />
      )}
      {dialogKonfirmasi}
    </section>
  );
}

function Miniatur({ foto, alt, bisaHapus, onHapus }: { foto: FotoLokal & { url: string }; alt: string; bisaHapus: boolean; onHapus: () => void }) {
  return (
    <figure className="relative size-20 shrink-0 animate-muncul overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob lokal */}
      <img src={foto.url} alt={alt} className="size-full object-cover" />
      {foto.uploaded && <span className="absolute bottom-1 left-1 rounded bg-success px-1 text-[10px] text-white">terkirim</span>}
      {bisaHapus && (
        <button type="button" aria-label="Hapus foto" className="absolute top-1 right-1 rounded-full bg-black/60 p-1.5 text-white" onClick={onHapus}>
          <Trash2 className="size-3.5" />
        </button>
      )}
    </figure>
  );
}
