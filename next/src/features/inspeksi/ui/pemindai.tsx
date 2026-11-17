"use client";

import { Camera, CameraOff, SwitchCamera } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { mulaiDariTeks } from "../client/aksi";
import { bukaKamera, buatPembacaQR, type PembacaQR } from "../client/qr";
import { useInspektur } from "./konteks";

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
      } catch {
        if (hidup) setKamera("gagal");
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pindai stiker QR</h1>
        <p className="text-sm text-muted-foreground">Arahkan kamera ke stiker pada tabung. Formulir terbuka setelah stiker dikenali.</p>
      </div>

      {!aman && (
        <p role="alert" className="rounded-lg bg-info-soft p-3 text-sm text-info">
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

      <PesanMuncul
        role="alert"
        testId="pesan-pindai"
        pesan={pesan || undefined}
        celah="1.25rem"
        className="my-0!"
        isiClassName="rounded-lg bg-danger-soft p-3 text-sm text-danger"
      />

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void proses(manual);
        }}
      >
        <Label htmlFor="kode-cadangan">Kode cadangan (tulisan kecil PAL-K3-… di bawah QR)</Label>
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
        <p className="text-xs text-muted-foreground">Spasi, baris baru, dan huruf besar tidak masalah. Nomor aset (mis. 01D) saja tidak cukup.</p>
        {!daring && <p className="text-xs text-muted-foreground">Luring: stiker dicocokkan dengan data di perangkat.</p>}
      </form>
    </div>
  );
}
