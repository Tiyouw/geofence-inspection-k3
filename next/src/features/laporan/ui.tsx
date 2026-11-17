/**
 * Potongan tampilan papan pantau. Warna hanya lewat token semantik (globals.css),
 * supaya rancangan kanvas bisa mengubah rupa tanpa menyentuh halaman.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { AnswerType, GateStatus, IssueStatus, Kesimpulan, Severity } from "@/lib/domain/constants";
import { LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

/**
 * Warna status tetap (keputusan pemilik) dan tidak pernah amber merek:
 * bahaya merah (temuan berat, lewat tenggat), tinjau oranye (perlu ditinjau),
 * info biru, netral abu (belum diperiksa), sukses hijau (layak).
 */
export type Nada = "netral" | "sukses" | "waspada" | "bahaya" | "info";

const NADA: Record<Nada, string> = {
  netral: "bg-muted text-muted-foreground",
  sukses: "bg-success-soft text-success",
  waspada: "bg-warning-soft text-warning",
  bahaya: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Lencana({ nada = "netral", children, className }: { nada?: Nada; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", NADA[nada], className)}>
      {children}
    </span>
  );
}

/** Label dan warna status gerbang (SPEC §3.5, Inspection.php:81-103). */
export const GERBANG: Record<GateStatus, { label: string; nada: Nada }> = {
  sesuai: { label: "Lokasi sesuai", nada: "sukses" },
  perlu_tinjauan: { label: "Perlu tinjauan", nada: "waspada" },
  perlu_review: { label: "Perlu ditinjau", nada: "waspada" },
  jauh: { label: "Jauh dari aset", nada: "bahaya" },
  gps_lemah: { label: "GPS lemah", nada: "info" },
  tidak_berlaku: { label: "Objek bergerak", nada: "netral" },
  tanpa_gps: { label: "Tanpa GPS", nada: "netral" },
};

export const NADA_KESIMPULAN: Record<Kesimpulan, Nada> = { layak: "sukses", layak_catatan: "waspada", tidak_layak: "bahaya" };
export const NADA_TINGKAT: Record<Severity, Nada> = { berat: "bahaya", sedang: "waspada", ringan: "info" };

export function LencanaHanyaLihat() {
  return (
    <Lencana nada="info" className="gap-1">
      Hanya lihat
    </Lencana>
  );
}
export const LABEL_STATUS_TEMUAN: Record<IssueStatus, string> = { terbuka: "Terbuka", proses: "Proses", selesai: "Selesai" };
export const NADA_STATUS_TEMUAN: Record<IssueStatus, Nada> = { terbuka: "bahaya", proses: "waspada", selesai: "sukses" };

export function LencanaGerbang({ status }: { status: GateStatus }) {
  return <Lencana nada={GERBANG[status].nada}>{GERBANG[status].label}</Lencana>;
}

export function LencanaKesimpulan({ k }: { k: Kesimpulan | null }) {
  if (!k) return <span className="text-muted-foreground">-</span>;
  return <Lencana nada={NADA_KESIMPULAN[k]}>{LABEL_KESIMPULAN[k]}</Lencana>;
}

/** Label pilihan dua-nilai sesuai dimensi (ChecklistItem::labelNilai). */
export function labelNilai(answerType: AnswerType, nilai: string | null, nilaiAngka: number | null, satuan?: string | null): string {
  if (answerType === "number") return nilaiAngka == null ? "-" : `${nilaiAngka}${satuan ? ` ${satuan}` : ""}`;
  if (nilai == null) return "-";
  const dua: Partial<Record<AnswerType, [string, string]>> = {
    fungsi: ["Berfungsi", "Tidak berfungsi"],
    boolean: ["Ada", "Tidak ada"],
    kondisi: ["Baik", "Tidak baik"],
  };
  const pasangan = dua[answerType];
  if (pasangan && (nilai === "ok" || nilai === "tidak")) return nilai === "ok" ? pasangan[0] : pasangan[1];
  return nilai;
}

/** Bilah progres sederhana (sudah/total). */
export function Bilah({ nilai, total, label }: { nilai: number; total: number; label: string }) {
  const persen = total ? Math.round((nilai / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="font-medium tabular-nums">
          {nilai}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-success" style={{ width: `${persen}%` }} />
      </div>
    </div>
  );
}

/** Tab berbasis tautan (filter lewat URL, tanpa JavaScript). */
export function TabTautan({ tabs }: { tabs: { href: string; label: string; jumlah?: number; aktif: boolean }[] }) {
  return (
    <nav aria-label="Saring" className="mb-4 flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.aktif ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            t.aktif ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.jumlah !== undefined && <span className="ml-1.5 rounded bg-muted px-1.5 text-xs tabular-nums">{t.jumlah}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Halaman({ dasar, halaman, total, per }: { dasar: string; halaman: number; total: number; per: number }) {
  const akhir = Math.max(1, Math.ceil(total / per));
  if (akhir <= 1) return null;
  const ke = (n: number) => `${dasar}${dasar.includes("?") ? "&" : "?"}halaman=${n}`;
  return (
    <nav aria-label="Halaman" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Halaman {halaman} dari {akhir}
      </span>
      <div className="flex gap-2">
        {halaman > 1 && (
          <Link className="rounded-md border px-3 py-1.5 hover:bg-muted" href={ke(halaman - 1)}>
            Sebelumnya
          </Link>
        )}
        {halaman < akhir && (
          <Link className="rounded-md border px-3 py-1.5 hover:bg-muted" href={ke(halaman + 1)}>
            Berikutnya
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Tabel ringkas dengan gaya bersama. */
export function Tabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table aria-label={label} className="w-full text-sm [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground [&_thead]:bg-muted/60 [&_tr]:border-b [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}

export function Kosong({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{children}</p>;
}
