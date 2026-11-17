"use client";

/**
 * Isian satu butir isi kotak P3K (PRD Checklist per modul, Grup B): jumlah, kondisi
 * Aman / Ada yang kedaluwarsa, dan tanggal kedaluwarsa terdekat untuk isi bertanda bintang.
 * Dipasang oleh IsianButir untuk butir yang isButirIsi(); penilaian di lib/domain/modul/p3k.
 */
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { KONDISI_ISI, LABEL_KONDISI_ISI, nilaiIsi, type KondisiIsi } from "@/lib/domain/modul/p3k";
import type { TipeKotak } from "@/lib/domain/modul/tipe";
import { cn } from "@/lib/utils";

export type IsianIsi = { nilaiAngka?: number | null; kondisiIsi?: KondisiIsi | null; tglKedaluwarsaTerdekat?: string | null };

export function IsianIsiP3k({
  item,
  tipeKotak,
  hariIni,
  nilai,
  bisaUbah,
  onJawab,
}: {
  item: { id: number; label: string; jumlahBaku: Partial<Record<TipeKotak, number>> | number | null; hasExpiry: boolean; satuan?: string | null };
  tipeKotak: TipeKotak;
  hariIni: string;
  nilai: IsianIsi | undefined;
  bisaUbah: boolean;
  onJawab: (isi: IsianIsi) => void;
}) {
  const [jumlah, setJumlah] = useState<string>(nilai?.nilaiAngka == null ? "" : String(nilai.nilaiAngka));
  const n = nilaiIsi(item, { checklistItemId: item.id, ...nilai }, { tipeKotak, hariIni });
  const satuan = item.satuan || "buah";
  const angka = jumlah === "" ? null : Number(jumlah);

  const ubahJumlah = (v: number | null) => {
    setJumlah(v === null ? "" : String(v));
    if (v !== null && Number.isInteger(v) && v >= 0) onJawab({ nilaiAngka: v });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Jumlah ({n.baku === null ? satuan : `baku ${n.baku} ${satuan}, kotak tipe ${tipeKotak}`})
        </p>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            aria-label={`Kurangi jumlah ${item.label}`}
            disabled={!bisaUbah || !angka}
            onClick={() => ubahJumlah(Math.max(0, (angka ?? 0) - 1))}
            className="grid size-14 shrink-0 place-items-center rounded-xl border bg-card transition-colors duration-200 disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden />
          </button>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            value={jumlah}
            disabled={!bisaUbah}
            aria-label={`Jumlah ${item.label}`}
            className="h-14 text-center text-lg font-semibold"
            onChange={(e) => ubahJumlah(e.target.value === "" ? null : Number(e.target.value))}
          />
          <button
            type="button"
            aria-label={`Tambah jumlah ${item.label}`}
            disabled={!bisaUbah}
            onClick={() => ubahJumlah((angka ?? 0) + 1)}
            className="grid size-14 shrink-0 place-items-center rounded-xl border bg-card transition-colors duration-200 disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {n.jumlah !== null && (n.kosong || n.kurang > 0) && (
          <p className="mt-1.5 text-xs font-medium text-danger">{n.kosong ? "Kosong." : `Kurang ${n.kurang} dari baku.`}</p>
        )}
      </div>

      {n.jumlah !== null && !n.kosong && (
        <>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Kondisi ${item.label}`}>
            {KONDISI_ISI.map((k) => {
              const aktif = nilai?.kondisiIsi === k;
              const buruk = k === "kedaluwarsa";
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  disabled={!bisaUbah}
                  onClick={() => onJawab({ kondisiIsi: k })}
                  className={cn(
                    "min-h-14 rounded-xl border px-3 py-2 text-base font-medium transition-colors duration-200",
                    aktif ? (buruk ? "border-danger bg-danger text-white" : "border-success bg-success text-white") : "bg-card",
                  )}
                >
                  {LABEL_KONDISI_ISI[k]}
                </button>
              );
            })}
          </div>

          {item.hasExpiry && (
            <div>
              <label htmlFor={`kedaluwarsa-${item.id}`} className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Tanggal kedaluwarsa terdekat
              </label>
              <Input
                id={`kedaluwarsa-${item.id}`}
                type="date"
                aria-label={`Kedaluwarsa terdekat ${item.label}`}
                defaultValue={nilai?.tglKedaluwarsaTerdekat ?? ""}
                disabled={!bisaUbah}
                className="h-14 text-base"
                onChange={(e) => onJawab({ tglKedaluwarsaTerdekat: e.target.value || null })}
              />
              {n.kedaluwarsa && nilai?.kondisiIsi !== "kedaluwarsa" && (
                <p className="mt-1.5 text-xs font-medium text-danger">Tanggal sudah lewat. Pilih &quot;{LABEL_KONDISI_ISI.kedaluwarsa}&quot;.</p>
              )}
              {n.segeraKedaluwarsa && (
                <p className="mt-1.5 text-xs font-medium text-info">
                  Segera kedaluwarsa: {n.sisaHari === 0 ? "hari ini" : `${n.sisaHari} hari lagi`}. Dicatat, bukan temuan.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
