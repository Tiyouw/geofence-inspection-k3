import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka muat (skeleton) sementara isi halaman diambil: bentuknya mirip halaman sebenarnya,
 * jadi pergantian ke isi terasa halus, bukan kedipan kosong lalu penuh.
 */
export function KerangkaHalaman({ varian = "desktop", label = "Memuat halaman…" }: { varian?: "desktop" | "ponsel"; label?: string }) {
  if (varian === "ponsel") {
    return (
      <div className="space-y-6" role="status" aria-label={label}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <KerangkaKartu />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/** Kartu ringkas (judul + beberapa baris) untuk kerangka di dalam halaman. */
export function KerangkaKartu({ baris = 3, label }: { baris?: number; label?: string }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4" role={label ? "status" : undefined} aria-label={label}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: baris }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
