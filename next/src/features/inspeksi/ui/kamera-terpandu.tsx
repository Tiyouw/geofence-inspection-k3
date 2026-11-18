"use client";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { Camera, CameraOff, Check, ChevronLeft, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { MAKS_JEPRETAN_LANGKAH, type LangkahFoto } from "@/lib/domain/langkah-foto";
import { cn } from "@/lib/utils";
import { batalSesiFoto, hapusFotoLokal, simpanJepretan, simpanSemuaFoto, ulangiLangkah } from "../client/aksi";
import { uuidv7 } from "../client/ids";
import { kompresBingkai } from "../client/kompres";
import { bukaKamera } from "../client/qr";
import type { FotoLokal, GpsBacaan } from "../client/types";
import { CapFoto } from "@/components/foto/cap-foto";
import type { DataCap } from "@/lib/foto/cap";
import { useInspektur } from "./konteks";

type FotoTampil = FotoLokal & { url: string };
type Posisi = { lat: number; lng: number; akurasi: number };

/** Semua foto draf (tersimpan dan sesi), dengan URL objek yang dilepas saat berganti. */
function useFotoDraf(inspectionId: string, versi: number) {
  const { db } = useInspektur();
  const [fotos, setFotos] = useState<FotoTampil[]>([]);
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
 * Kamera terpandu (PRD "Aturan bukti" 3, ADR-8, Tech Spec "Design system"): layar penuh,
 * kamera belakang dari aplikasi (tanpa galeri), satu langkah per layar dengan teks besar
 * "Foto sekarang: {langkah}", boleh beberapa jepretan, lalu Lanjut. Setelah langkah terakhir
 * inspektur meninjau, mengulang, atau menghapus, lalu "Simpan semua" memasukkan semua foto
 * ke antrean unggah sekaligus.
 */
export function KameraTerpandu({
  inspectionId,
  langkah,
  labelButir,
  mulaiDari = 0,
  gpsDraf,
  onTutup,
}: {
  inspectionId: string;
  langkah: LangkahFoto[];
  labelButir: Record<number, string>;
  mulaiDari?: number;
  gpsDraf: GpsBacaan | null;
  onTutup: (disimpan: boolean) => void;
}) {
  const { db, berubah, data } = useInspektur();
  const [versi, setVersi] = useState(0);
  const fotos = useFotoDraf(inspectionId, versi);
  const [mode, setMode] = useState<"kamera" | "tinjau">("kamera");
  const [indeks, setIndeks] = useState(mulaiDari);
  /** Ulangi langkah dari layar tinjau: Lanjut kembali ke tinjau, bukan ke langkah berikutnya. */
  const [kembaliKeTinjau, setKembaliKeTinjau] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [lihat, setLihat] = useState<FotoTampil | null>(null);

  const segarkan = useCallback(() => {
    setVersi((v) => v + 1);
    berubah();
  }, [berubah]);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();

  const l = langkah[indeks]!;
  const fotoLangkah = (kode: string) => fotos.filter((f) => f.langkah === kode);
  const jumlahSesi = fotos.filter((f) => f.sesi).length;
  const kosong = langkah.filter((x) => fotoLangkah(x.kode).length === 0);

  const lanjut = () => {
    setPesan(null);
    if (kembaliKeTinjau || indeks === langkah.length - 1) {
      setKembaliKeTinjau(false);
      setMode("tinjau");
    } else setIndeks(indeks + 1);
  };

  const simpan = async () => {
    if (kosong.length) return setPesan(`Masih ada butir tanpa jawaban atau langkah foto yang belum diisi: ${kosong.map((x) => x.judul).join(", ")}`);
    setMenyimpan(true);
    try {
      await simpanSemuaFoto(db!, inspectionId);
      void navigator.storage?.persist?.();
      segarkan();
      onTutup(true);
    } catch (e) {
      setPesan((e as Error).message);
      setMenyimpan(false);
    }
  };

  const tutup = async () => {
    if (
      jumlahSesi > 0 &&
      !(await konfirmasi({
        judul: "Tutup kamera?",
        jumlah: `${jumlahSesi} foto belum disimpan`,
        isi: "Foto yang belum disimpan akan dibuang. Foto yang sudah disimpan tetap ada.",
        tombol: "Tutup dan buang",
        batal: "Lanjut memotret",
        bahaya: true,
      }))
    )
      return;
    await batalSesiFoto(db!, inspectionId);
    segarkan();
    onTutup(false);
  };

  const hapus = async (f: FotoTampil) => {
    if (
      !f.sesi &&
      !(await konfirmasi({ judul: "Hapus foto ini?", isi: "Foto yang sudah disimpan ini dihapus dari draf.", tombol: "Hapus foto", bahaya: true }))
    )
      return;
    await hapusFotoLokal(db!, inspectionId, f.photoId);
    setLihat(null);
    segarkan();
  };

  const capDari = (f: FotoTampil): DataCap => {
    const paket = data.paket;
    const aset = paket?.aset.find((a) => a.id === data.drafts.find((d) => d.inspectionId === inspectionId)?.assetId);
    const area = aset?.areaId != null ? (paket?.gerbang?.area[aset.areaId]?.nama ?? null) : null;
    return {
      waktu: f.takenAtDevice,
      area: area ?? aset?.gedung ?? null,
      kode: aset?.kode ?? "",
      inspektur: paket?.cap?.inspektur ?? null,
      akurasiM: f.akurasi ?? null,
      ambangLemahM: paket?.gerbang?.pengaturan.akurasiLemahM,
      koordinat: paket?.cap?.koordinat && f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null,
    };
  };

  // Portal ke body: leluhur beranimasi (#isi) membuat position:fixed terkurung di kolom isi.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kamera terpandu"
      data-testid="kamera-terpandu"
      data-peran="inspektur"
      className="fixed inset-0 z-50 flex animate-muncul flex-col bg-black text-white"
    >
      {mode === "kamera" ? (
        <LayarKamera
          key={l.kode}
          langkah={l}
          nomor={indeks + 1}
          total={langkah.length}
          labelButir={labelButir}
          fotos={fotoLangkah(l.kode)}
          gpsDraf={gpsDraf}
          onJepret={async (k, posisi) => {
            setPesan(null);
            await simpanJepretan(db!, {
              photoId: uuidv7(),
              inspectionId,
              langkah: l.kode,
              blob: k.blob,
              contentType: "image/jpeg",
              sha256: k.sha256,
              bytes: k.blob.size,
              width: k.width,
              height: k.height,
              takenAtDevice: new Date().toISOString(),
              lat: posisi?.lat ?? null,
              lng: posisi?.lng ?? null,
              akurasi: posisi?.akurasi ?? null,
            });
            navigator.vibrate?.(30);
            segarkan();
          }}
          onGalat={setPesan}
          onLanjut={lanjut}
          onKembali={indeks > 0 && !kembaliKeTinjau ? () => setIndeks(indeks - 1) : undefined}
          onTutup={() => void tutup()}
          onLihat={setLihat}
          labelLanjut={kembaliKeTinjau || indeks === langkah.length - 1 ? "Tinjau" : "Lanjut"}
        />
      ) : (
        <LayarTinjau
          langkah={langkah}
          fotoLangkah={fotoLangkah}
          jumlahSesi={jumlahSesi}
          menyimpan={menyimpan}
          onUlangi={async (i) => {
            await ulangiLangkah(db!, inspectionId, langkah[i]!.kode);
            segarkan();
            setIndeks(i);
            setKembaliKeTinjau(true);
            setMode("kamera");
          }}
          onLihat={setLihat}
          onSimpan={() => void simpan()}
          onTutup={() => void tutup()}
        />
      )}

      <PesanMuncul
        role="alert"
        testId="galat-kamera"
        pesan={pesan || undefined}
        className="pointer-events-none absolute inset-x-4 top-24 z-10"
        isiClassName="rounded-lg bg-danger p-3 text-sm text-white shadow-lg"
      />

      {lihat && (
        <div className="absolute inset-0 z-20 flex animate-muncul flex-col bg-black/95" data-testid="pratinjau-foto">
          <div className="relative min-h-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob lokal */}
            <img src={lihat.url} alt="Pratinjau foto" className="absolute inset-0 size-full object-contain" />
            <CapFoto data={capDari(lihat)} />
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-14 border-white/30 bg-transparent text-base text-white" onClick={() => setLihat(null)}>
              Kembali
            </Button>
            <Button variant="destructive" className="h-14 bg-danger text-base text-white hover:bg-danger/90" onClick={() => void hapus(lihat)}>
              <Trash2 aria-hidden /> Hapus foto
            </Button>
          </div>
        </div>
      )}
      {dialogKonfirmasi}
    </div>,
    document.body,
  );
}

function LayarKamera({
  langkah,
  nomor,
  total,
  labelButir,
  fotos,
  gpsDraf,
  onJepret,
  onGalat,
  onLanjut,
  onKembali,
  onTutup,
  onLihat,
  labelLanjut,
}: {
  langkah: LangkahFoto;
  nomor: number;
  total: number;
  labelButir: Record<number, string>;
  fotos: FotoTampil[];
  gpsDraf: GpsBacaan | null;
  onJepret: (k: Awaited<ReturnType<typeof kompresBingkai>>, posisi: Posisi | null) => Promise<void>;
  onGalat: (pesan: string) => void;
  onLanjut: () => void;
  onKembali?: () => void;
  onTutup: () => void;
  onLihat: (f: FotoTampil) => void;
  labelLanjut: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const posisi = useRef<Posisi | null>(gpsDraf ? { lat: gpsDraf.lat, lng: gpsDraf.lng, akurasi: gpsDraf.accuracy } : null);
  const [kamera, setKamera] = useState<"membuka" | "nyala" | "gagal">("membuka");
  const [coba, setCoba] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [kilat, setKilat] = useState(false);
  const penuh = fotos.length >= MAKS_JEPRETAN_LANGKAH;

  // Kamera belakang (exact → label perangkat → ideal), dilepas saat langkah atau layar ditinggal.
  useEffect(() => {
    let hidup = true;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        const s = await bukaKamera("environment");
        if (!hidup) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        v.setAttribute("playsinline", "true");
        await v.play();
        v.dataset.hadap = s.getVideoTracks()[0]?.getSettings?.().facingMode ?? "";
        setKamera("nyala");
      } catch {
        if (hidup) setKamera("gagal");
      }
    })();
    return () => {
      hidup = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [coba]);

  // Posisi setiap jepretan: bacaan terbaru selama kamera terbuka (PRD Aturan bukti 3).
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        posisi.current = { lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const jepret = async () => {
    const v = video.current;
    if (!v || sibuk || penuh || kamera !== "nyala") return;
    setSibuk(true);
    setKilat(true);
    setTimeout(() => setKilat(false), 90);
    try {
      const k = await kompresBingkai(v, v.videoWidth, v.videoHeight);
      await onJepret(k, posisi.current);
    } catch (e) {
      onGalat((e as Error).message || "Foto belum tersimpan. Ulangi langkah ini.");
    } finally {
      setSibuk(false);
    }
  };

  const butir = langkah.itemIds.map((id) => labelButir[id]).filter(Boolean);

  return (
    <>
      <header className="relative z-10 space-y-1 bg-gradient-to-b from-black/90 to-black/0 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-white/70 uppercase" data-testid="nomor-langkah">
            Langkah {nomor} dari {total}
          </p>
          <button type="button" onClick={onTutup} className="-mr-2 rounded-full p-2 text-white/80" aria-label="Tutup kamera">
            <X className="size-6" />
          </button>
        </div>
        <h2 key={langkah.kode} className="animate-muncul text-2xl leading-tight font-semibold" data-testid="judul-langkah">
          Foto sekarang: {langkah.judul}
        </h2>
        {langkah.petunjuk && <p className="text-sm text-white/80">{langkah.petunjuk}</p>}
        {butir.length > 0 && (
          <p className="line-clamp-2 text-xs text-white/60">Bukti untuk: {butir.join(", ")}</p>
        )}
      </header>

      <div className="relative -mt-24 min-h-0 flex-1 overflow-hidden">
        <video ref={video} playsInline muted data-testid="video-kamera" className="size-full object-cover" />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-white transition-opacity ease-halus",
            kilat ? "opacity-50 duration-75" : "opacity-0 duration-500",
          )}
        />
        {kamera !== "nyala" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {kamera === "membuka" ? (
              <Loader2 className="size-8 animate-spin text-white/70" aria-label="Membuka kamera" />
            ) : (
              <div className="max-w-xs space-y-3">
                <CameraOff className="mx-auto size-10 opacity-70" aria-hidden />
                <p className="text-sm text-white/80">
                  Kamera tidak bisa dibuka. Izinkan kamera untuk aplikasi ini di pengaturan peramban. Foto hanya dapat diambil dari
                  kamera aplikasi.
                </p>
                <Button variant="brand" className="h-12" onClick={() => (setKamera("membuka"), setCoba((c) => c + 1))}>
                  Coba lagi
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="space-y-3 bg-black px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex h-16 items-center gap-2 overflow-x-auto" aria-label="Foto langkah ini">
          {fotos.map((f) => (
            <button
              key={f.photoId}
              type="button"
              onClick={() => onLihat(f)}
              className="relative size-14 shrink-0 animate-muncul overflow-hidden rounded-lg ring-1 ring-white/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob lokal */}
              <img src={f.url} alt={`Foto ${langkah.judul}`} className="size-full object-cover" />
              {!f.sesi && (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] leading-4">tersimpan</span>
              )}
            </button>
          ))}
          {fotos.length === 0 && <p className="text-sm text-white/60">Belum ada foto untuk langkah ini.</p>}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            {onKembali && (
              <Button variant="ghost" className="h-14 px-2 text-white hover:bg-white/10 hover:text-white" onClick={onKembali}>
                <ChevronLeft aria-hidden /> Sebelumnya
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void jepret()}
            disabled={kamera !== "nyala" || sibuk || penuh}
            aria-label="Jepret"
            className="grid size-20 place-items-center rounded-full bg-brand text-brand-foreground ring-4 ring-white/80 transition-transform duration-200 ease-halus active:scale-95 disabled:opacity-40"
          >
            {sibuk ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <Camera className="size-8" aria-hidden />}
          </button>
          <div className="text-right">
            <Button
              variant="outline"
              className="h-14 border-white/40 bg-transparent px-5 text-base text-white hover:bg-white/10 hover:text-white"
              disabled={fotos.length === 0 || sibuk}
              onClick={onLanjut}
            >
              {labelLanjut}
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-white/60" data-testid="penghitung-jepretan">
          {fotos.length}/{MAKS_JEPRETAN_LANGKAH} foto
          {penuh && " · batas langkah ini tercapai"}
        </p>
      </footer>
    </>
  );
}

function LayarTinjau({
  langkah,
  fotoLangkah,
  jumlahSesi,
  menyimpan,
  onUlangi,
  onLihat,
  onSimpan,
  onTutup,
}: {
  langkah: LangkahFoto[];
  fotoLangkah: (kode: string) => FotoTampil[];
  jumlahSesi: number;
  menyimpan: boolean;
  onUlangi: (i: number) => void;
  onLihat: (f: FotoTampil) => void;
  onSimpan: () => void;
  onTutup: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 animate-muncul flex-col bg-neutral-900" data-testid="tinjau-foto">
      <header className="flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-white/70 uppercase">Tinjau sebelum menyimpan</p>
          <h2 className="text-xl font-semibold">Foto bukti</h2>
        </div>
        <button type="button" onClick={onTutup} className="-mr-2 rounded-full p-2 text-white/80" aria-label="Tutup kamera">
          <X className="size-6" />
        </button>
      </header>
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {langkah.map((l, i) => {
          const f = fotoLangkah(l.kode);
          return (
            <li key={l.kode} className="space-y-2 rounded-xl bg-white/5 p-3" data-testid={`tinjau-${l.kode}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {i + 1}. {l.judul}
                  </p>
                  <p className={cn("text-xs", f.length ? "text-white/60" : "text-danger")}>
                    {f.length ? `${f.length} foto` : "Belum ada foto"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  onClick={() => onUlangi(i)}
                >
                  <RotateCcw aria-hidden /> {f.length ? "Ulangi" : "Ambil"}
                </Button>
              </div>
              {f.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {f.map((x) => (
                    <button
                      key={x.photoId}
                      type="button"
                      onClick={() => onLihat(x)}
                      className="relative size-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob lokal */}
                      <img src={x.url} alt={`Foto ${l.judul}`} className="size-full object-cover" />
                      {!x.sesi && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] leading-4">tersimpan</span>}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <footer className="border-t border-white/10 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button variant="brand" className="h-14 w-full text-base" disabled={menyimpan} onClick={onSimpan}>
          {menyimpan ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {jumlahSesi > 0 ? `Simpan semua (${jumlahSesi} foto)` : "Selesai"}
        </Button>
      </footer>
    </div>
  );
}
