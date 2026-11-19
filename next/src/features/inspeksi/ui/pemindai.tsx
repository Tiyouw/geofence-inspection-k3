"use client";

import { Camera, CameraOff, Keyboard, LocateFixed, MapPinOff, ShieldAlert, SwitchCamera, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { mulaiDariTeks } from "../client/aksi";
import { bukaKamera, buatPembacaQR, type PembacaQR } from "../client/qr";
import { LANGKAH_LOKASI_ANDROID } from "@/lib/geo/gerbang";
import { cn } from "@/lib/utils";
import { Cip, KARTU, KONTROL, Pita } from "./a";
import { useInspektur } from "./konteks";
import { pindahLapangan } from "./tautan";

/**
 * SPEC §3.1/§3.2: pemindai di aplikasi. Kamera belakang dulu, bisa ganti kamera, dilepas
 * saat halaman ditinggal. Menerima URL stiker atau token mentah; kode cadangan bisa diketik.
 */
export function Pemindai({ tokenAwal }: { tokenAwal?: string }) {
  const { db, daring, berubah, siap } = useInspektur();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const sibuk = useRef(false);
  const [kamera, setKamera] = useState<"mati" | "nyala" | "gagal" | "ditolak">("mati");
  const gps = useCekGps();
  const [hadap, setHadap] = useState<"environment" | "user">("environment");
  const [pesan, setPesan] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const aman = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext,
    () => true,
  );

  const proses = useCallback(
    async (teks: string) => {
      if (!db || sibuk.current) return;
      sibuk.current = true;
      setPesan(null);
      const r = await mulaiDariTeks(db, teks, { daring: navigator.onLine });
      if (r.ok) {
        navigator.vibrate?.(30);
        berubah();
        pindahLapangan(router, `/petugas/isi?id=${r.inspectionId}`);
        return;
      }
      setPesan(r.pesan);
      sibuk.current = false;
    },
    [db, berubah, router],
  );

  const lepas = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // Token dari pintasan /i/{token} saat luring (dialihkan service worker ke sini).
  useEffect(() => {
    if (!tokenAwal || !siap || !db) return;
    const t = setTimeout(() => void proses(tokenAwal), 0);
    return () => clearTimeout(t);
  }, [tokenAwal, siap, db, proses]);

  useEffect(() => {
    if (kamera !== "nyala") return;
    let hidup = true;
    // QR yang sama yang baru saja ditolak tidak diproses ulang tiap bingkai (tiap penolakan
    // daring memicu unduh ulang paket).
    let terakhir = { teks: "", waktu: 0 };

    (async () => {
      let pembaca: PembacaQR;
      try {
        const s = await bukaKamera(hadap);
        if (!hidup) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = video.current!;
        v.srcObject = s;
        v.setAttribute("playsinline", "true"); // iOS Safari: jangan layar penuh
        await v.play();
        pembaca = await buatPembacaQR();
        v.dataset.mesin = pembaca.mesin();
        v.dataset.hadap = s.getVideoTracks()[0]?.getSettings?.().facingMode ?? "";
      } catch (e) {
        // Izin ditolak dibedakan dari kamera yang sedang dipakai aplikasi lain atau tidak ada.
        if (hidup) setKamera((e as DOMException)?.name === "NotAllowedError" ? "ditolak" : "gagal");
        return;
      }
      const loop = async () => {
        if (!hidup) return;
        const v = video.current;
        const c = kanvas.current;
        const hasil = v && c ? await pembaca.baca(v, c).catch(() => null) : null;
        if (hidup && hasil && !(hasil === terakhir.teks && Date.now() - terakhir.waktu < 3000)) {
          terakhir = { teks: hasil, waktu: Date.now() };
          await proses(hasil);
        }
        if (hidup) setTimeout(() => requestAnimationFrame(() => void loop()), 80);
      };
      void loop();
    })();

    return () => {
      hidup = false;
      lepas();
    };
  }, [kamera, hadap, proses, lepas]);

  useEffect(() => lepas, [lepas]);

  // Penolakan karena stiker milik unit lain bukan galat: nada peringatan, bukan bahaya.
  const unitLain = !!pesan && /milik/i.test(pesan);
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Pindai stiker QR</h1>
          <p className="text-sm text-muted-foreground">Arahkan kamera ke stiker pada aset. Formulir terbuka setelah stiker dikenali.</p>
        </div>
        <CipGps g={gps} />
      </div>

      {gps.status === "mati" && (
        <Pita nada="bad" ikon={<MapPinOff className="mt-0.5 size-5 shrink-0" aria-hidden />} judul="Lokasi ponsel mati atau izinnya ditolak" data-testid="pindai-gps-mati">
          <p>Stiker tetap bisa dipindai, tetapi inspeksi baru bisa dikirim setelah Lokasi (GPS) menyala.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {LANGKAH_LOKASI_ANDROID.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </Pita>
      )}
      {gps.status === "lemah" && (
        <Pita nada="warn" ikon={<TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />} judul={`Sinyal GPS lemah (±${gps.akurasi} m)`} data-testid="pindai-gps-lemah">
          Melangkahlah ke dekat pintu atau area terbuka. Inspeksi tetap bisa dikirim dan akan ditinjau.
        </Pita>
      )}

      {!aman && (
        <p role="alert" className="rounded-lg bg-info-soft p-3 text-sm text-info">
          Kamera hanya bisa dipakai lewat sambungan aman (HTTPS). Ketik kode cadangan di bawah.
        </p>
      )}

      {kamera === "ditolak" ? (
        <div className={cn(KARTU, "space-y-3 p-4")} data-testid="kamera-ditolak">
          <CameraOff className="size-8 text-danger" aria-hidden />
          <p className="text-lg font-bold">Kamera belum diizinkan</p>
          <p className="text-sm text-muted-foreground">Aplikasi perlu kamera untuk membaca stiker dan memotret bukti. Foto dari galeri tidak diterima.</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Ketuk ikon di kiri alamat situs.</li>
            <li>
              Pilih <b>Izin</b>, lalu izinkan <b>Kamera</b>.
            </li>
            <li>Kembali ke sini dan ketuk Coba lagi.</li>
          </ol>
          <Button variant="brand" className="h-12" onClick={() => setKamera("nyala")}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <div className="relative aspect-square overflow-hidden rounded-[var(--a-radius-kartu,16px)] bg-primary">
          <video ref={video} playsInline muted className={kamera === "nyala" ? "size-full object-cover" : "hidden"} />
          <canvas ref={kanvas} className="hidden" />
          {kamera !== "nyala" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
              <div className="space-y-3">
                {kamera === "gagal" ? <CameraOff className="mx-auto size-10 opacity-70" /> : <Camera className="mx-auto size-10 opacity-70" />}
                <p className="text-sm text-white/80">
                  {kamera === "gagal" ? "Kamera tidak bisa dibuka. Izinkan kamera atau ketik kode cadangan." : "Kamera belum menyala."}
                </p>
                <Button variant="brand" className="h-12 px-6" onClick={() => setKamera("nyala")} disabled={!aman}>
                  Nyalakan kamera
                </Button>
              </div>
            </div>
          )}
          {kamera === "nyala" && (
            <>
              <p className="pointer-events-none absolute inset-x-3 top-3 text-center text-sm font-medium text-white drop-shadow">Arahkan ke stiker QR pada aset</p>
              <div aria-hidden className="pointer-events-none absolute inset-[18%]">
                {SUDUT.map((c) => (
                  <span key={c} className={cn("absolute size-11 border-brand", c)} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setHadap((h) => (h === "environment" ? "user" : "environment"))}
                className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-black/50 text-white"
                aria-label="Ganti kamera"
              >
                <SwitchCamera className="size-5" />
              </button>
            </>
          )}
        </div>
      )}

      <PesanMuncul
        role="alert"
        testId="pesan-pindai"
        pesan={
          pesan ? (
            <span className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{pesan}</span>
            </span>
          ) : undefined
        }
        celah="1.25rem"
        className="my-0!"
        isiClassName={cn("rounded-[var(--a-radius-kontrol,10px)] p-3 text-sm", unitLain ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")}
      />

      <form
        className={cn(KARTU, "space-y-2.5 p-4")}
        onSubmit={(e) => {
          e.preventDefault();
          void proses(manual);
        }}
      >
        <Label htmlFor="kode-cadangan" className="flex items-center gap-2">
          <Keyboard className="size-4 text-muted-foreground" aria-hidden />
          Kode cadangan (tulisan kecil PAL-K3-… di bawah QR)
        </Label>
        <div className="flex gap-2">
          <Input
            id="kode-cadangan"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="PAL-K3-…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={cn(KONTROL, "h-12 font-mono text-base")}
          />
          <Button type="submit" className={cn(KONTROL, "h-12 px-5")} disabled={!siap || !manual.trim()}>
            Buka
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Spasi, baris baru, dan huruf besar tidak masalah. Nomor aset (mis. 01D) saja tidak cukup.</p>
        {!daring && <p className="text-sm text-muted-foreground">Luring: stiker dicocokkan dengan data di perangkat.</p>}
      </form>
    </div>
  );
}

const SUDUT = [
  "top-0 left-0 rounded-tl-xl border-t-4 border-l-4",
  "top-0 right-0 rounded-tr-xl border-t-4 border-r-4",
  "bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4",
  "right-0 bottom-0 rounded-br-xl border-r-4 border-b-4",
];

type CekGps = { status: "mencari" | "baik" | "lemah" | "mati" | "tidak-didukung"; akurasi: number | null };

/**
 * Cek GPS sebelum memindai: lokasi mati/izin ditolak, atau akurasi di atas ambang lemah
 * (pengaturan gerbang dari paket kerja). Hanya petunjuk; keputusan tetap di formulir dan peladen.
 */
function useCekGps(): CekGps {
  const { data } = useInspektur();
  const ambang = data.paket?.gerbang?.pengaturan.akurasiLemahM ?? 100;
  const [g, setG] = useState<CekGps>({ status: "mencari", akurasi: null });
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const t = setTimeout(() => setG({ status: "tidak-didukung", akurasi: null }), 0);
      return () => clearTimeout(t);
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const a = Math.round(p.coords.accuracy);
        setG({ status: a > ambang ? "lemah" : "baik", akurasi: a });
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED || e.code === e.POSITION_UNAVAILABLE) setG({ status: "mati", akurasi: null });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [ambang]);
  return g;
}

function CipGps({ g }: { g: CekGps }) {
  if (g.status === "mati")
    return (
      <Cip nada="bad">
        <MapPinOff className="size-3.5" aria-hidden />
        GPS mati
      </Cip>
    );
  if (g.status === "lemah")
    return (
      <Cip nada="warn">
        <LocateFixed className="size-3.5" aria-hidden />±{g.akurasi} m
      </Cip>
    );
  if (g.status === "baik")
    return (
      <Cip nada="ok">
        <LocateFixed className="size-3.5" aria-hidden />±{g.akurasi} m
      </Cip>
    );
  if (g.status === "mencari")
    return (
      <Cip>
        <LocateFixed className="size-3.5" aria-hidden />
        Mencari GPS
      </Cip>
    );
  return null;
}
