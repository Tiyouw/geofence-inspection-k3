import { barisCap, type DataCap } from "@/lib/foto/cap";
import { cn } from "@/lib/utils";

/**
 * Cap foto sebagai lapisan di atas gambar (bukan dibakar ke JPEG). Induknya harus `relative`.
 * `ringkas` untuk miniatur: hanya waktu dan kode aset.
 */
export function CapFoto({ data, ringkas = false, className }: { data: DataCap; ringkas?: boolean; className?: string }) {
  const [waktu, ...lain] = barisCap(data);
  return (
    <div
      data-testid="cap-foto"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-black/0 text-white tabular-nums",
        ringkas ? "px-1.5 pt-4 pb-1 text-[10px] leading-tight" : "px-3 pt-8 pb-2.5 text-[12px] leading-snug",
        className,
      )}
    >
      <p className="font-bold">{waktu}</p>
      {ringkas ? <p className="truncate opacity-90">{data.kode}</p> : lain.map((b) => <p key={b}>{b}</p>)}
    </div>
  );
}
