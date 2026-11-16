"use client";

import { Camera, CameraOff, SwitchCamera } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mulaiDariTeks } from "../client/aksi";
import { useInspektur } from "./konteks";

type Detektor = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

/**
 * SPEC §3.1/§3.2: pemindai di aplikasi. Kamera belakang dulu, bisa ganti kamera, dilepas
 * saat halaman ditinggal. Menerima URL stiker atau token mentah; kode cadangan bisa diketik.
 */
export function Pemindai({ tokenAwal }: { tokenAwal?: string }) {
  const { db, daring, berubah, siap } = useInspektur();
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const sibuk = useRef(false);
  const [kamera, setKamera] = useState<"mati" | "nyala" | "gagal">("mati");
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
        // navigasi penuh: halaman lapangan dilayani service worker saat luring
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/petugas/isi?id=${r.inspectionId}`);
        return;
      }
      setPesan(r.pesan);
      sibuk.current = false;
    },
    [db, berubah],
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
    let detektor: Detektor | null = null;
    const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detektor }).BarcodeDetector;
    if (BD) detektor = new BD({ formats: ["qr_code"] });

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: hadap } }, audio: false });
        if (!hidup) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        video.current!.srcObject = s;
        await video.current!.play();
      } catch {
        setKamera("gagal");
        return;
      }
      const jsQR = detektor ? null : (await import("jsqr")).default;
      const loop = async () => {
        if (!hidup || !video.current || video.current.readyState < 2) {
          if (hidup) requestAnimationFrame(loop);
          return;
        }
        let hasil: string | null = null;
        if (detektor) {
          const kode = await detektor.detect(video.current).catch(() => []);
          hasil = kode[0]?.rawValue ?? null;
        } else if (jsQR && kanvas.current) {
          const v = video.current;
          const c = kanvas.current;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          hasil = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
        if (hasil) await proses(hasil);
        if (hidup) setTimeout(() => requestAnimationFrame(loop), 120);
      };
      requestAnimationFrame(loop);
    })();

    return () => {
      hidup = false;
      lepas();
    };
  }, [kamera, hadap, proses, lepas]);

  useEffect(() => lepas, [lepas]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pindai stiker QR</h1>
        <p className="text-sm text-muted-foreground">Arahkan kamera ke stiker pada tabung. Formulir terbuka setelah stiker dikenali.</p>
      </div>

      {!aman && (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          Kamera hanya bisa dipakai lewat sambungan aman (HTTPS). Ketik kode cadangan di bawah.
        </p>
      )}

      <div className="relative aspect-square overflow-hidden rounded-2xl bg-primary">
        <video ref={video} playsInline muted className={kamera === "nyala" ? "size-full object-cover" : "hidden"} />
        <canvas ref={kanvas} className="hidden" />
        {kamera !== "nyala" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div className="space-y-3">
              {kamera === "gagal" ? <CameraOff className="mx-auto size-10 opacity-70" /> : <Camera className="mx-auto size-10 opacity-70" />}
              <p className="text-sm text-white/80">
                {kamera === "gagal" ? "Kamera tidak bisa dibuka. Izinkan kamera atau ketik kode cadangan." : "Kamera belum menyala."}
              </p>
              <Button variant="brand" onClick={() => setKamera("nyala")} disabled={!aman}>
                Nyalakan kamera
              </Button>
            </div>
          </div>
        )}
        {kamera === "nyala" && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-brand" />
            <button
              type="button"
              onClick={() => setHadap((h) => (h === "environment" ? "user" : "environment"))}
              className="absolute right-3 bottom-3 rounded-full bg-black/50 p-2.5 text-white"
              aria-label="Ganti kamera"
            >
              <SwitchCamera className="size-5" />
            </button>
          </>
        )}
      </div>

      {pesan && (
        <p role="alert" data-testid="pesan-pindai" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {pesan}
        </p>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void proses(manual);
        }}
      >
        <Label htmlFor="kode-cadangan">Kode cadangan (tertulis di bawah QR)</Label>
        <div className="flex gap-2">
          <Input
            id="kode-cadangan"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="PAL-K3-…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 font-mono"
          />
          <Button type="submit" className="h-11" disabled={!siap || !manual.trim()}>
            Buka
          </Button>
        </div>
        {!daring && <p className="text-xs text-muted-foreground">Luring: stiker dicocokkan dengan data di perangkat.</p>}
      </form>
    </div>
  );
}
