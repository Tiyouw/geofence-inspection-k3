import { ShieldOff } from "lucide-react";
import type { ButirDenganFoto, FotoBukti } from "../server/foto-butir";
import { formatWaktu } from "@/lib/format";

function Miniatur({ f, alt }: { f: FotoBukti; alt: string }) {
  const waktu = formatWaktu(f.takenAtDevice ?? f.uploadedAt);
  return (
    <a
      href={`/api/foto/${f.id}`}
      target="_blank"
      rel="noopener"
      className="block size-16 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90"
      title={`${f.langkah ?? "Foto"} · ${waktu}${f.gpsAccuracy != null ? ` · GPS ±${f.gpsAccuracy} m` : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- foto privat lewat rute bersesi */}
      <img src={`/api/foto/${f.id}`} alt={alt} loading="lazy" className="size-full object-cover" />
    </a>
  );
}

/**
 * Foto bukti per butir checklist untuk Admin K3 dan Pemantau (PRD "Aturan bukti" 3). Satu foto
 * dapat menjadi bukti beberapa butir, jadi foto yang sama bisa tampil di beberapa baris.
 * Gambar lewat /api/foto/{id} yang memeriksa sesi.
 */
export function FotoPerButir({ data }: { data: { areaTerbatas: boolean; butir: ButirDenganFoto[]; tanpaLangkah: FotoBukti[] } }) {
  if (data.areaTerbatas) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm" data-testid="foto-area-terbatas">
        <ShieldOff className="size-4 shrink-0" aria-hidden /> Area terbatas (tanpa foto): bukti berupa QR dan GPS.
      </p>
    );
  }
  const terisi = data.butir.filter((b) => b.foto.length > 0);
  if (terisi.length === 0 && data.tanpaLangkah.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada foto per butir.</p>;
  }
  return (
    <div className="space-y-3" data-testid="foto-per-butir">
      <ul className="divide-y">
        {data.butir.map((b) => (
          <li key={b.id} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(10rem,16rem)_1fr]" data-testid={`foto-butir-${b.id}`}>
            <div className="text-sm">
              <p className="font-medium">{b.label}</p>
              <p className="text-xs text-muted-foreground">
                {b.grup}
                {b.foto[0]?.langkah ? ` · langkah ${b.foto[0].langkah}` : ""}
              </p>
            </div>
            {b.foto.length ? (
              <div className="flex gap-2 overflow-x-auto">
                {b.foto.map((f, n) => (
                  <Miniatur key={f.id} f={f} alt={`Foto ${b.label} ${n + 1}`} />
                ))}
              </div>
            ) : (
              <p className="self-center text-xs text-muted-foreground">Tanpa foto</p>
            )}
          </li>
        ))}
      </ul>
      {data.tanpaLangkah.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Foto tanpa langkah (sebelum kamera terpandu)</p>
          <div className="flex flex-wrap gap-2">
            {data.tanpaLangkah.map((f, n) => (
              <Miniatur key={f.id} f={f} alt={`Foto tanpa langkah ${n + 1}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
