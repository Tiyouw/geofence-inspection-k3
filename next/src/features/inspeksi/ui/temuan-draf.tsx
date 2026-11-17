"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { LABEL_TINDAKAN, TINDAKAN_REKOMENDASI, type TindakanRekomendasi } from "@/lib/domain/constants";
import type { Temuan } from "@/lib/domain/inspeksi";
import type { JawabanLokal } from "../client/types";
import { LencanaSeverity } from "./lencana";

/**
 * Pratinjau temuan selama draf (PRD Temuan): temuan baru dibuat saat inspeksi final.
 * Inspektur dapat mengganti tindakan yang direkomendasikan dan menambah uraian bebas.
 */
export function TemuanDraf({
  temuan,
  jawaban,
  bisaUbah,
  onUbah,
}: {
  temuan: Temuan[];
  jawaban: Record<number, JawabanLokal>;
  bisaUbah: boolean;
  onUbah: (itemId: number, isi: { tindakanRekomendasi?: TindakanRekomendasi; uraianTindakan?: string | null }) => void;
}) {
  if (!temuan.length) return null;
  return (
    <div className="space-y-3" data-testid="pratinjau-temuan">
      <p className="text-sm font-semibold">Temuan ({temuan.length})</p>
      <ul className="space-y-3">
        {temuan.map((t) => (
          <li key={t.checklistItemId} className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-3 text-sm">
              <span>{t.item}</span>
              <LencanaSeverity s={t.severity} />
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Tindakan yang direkomendasikan
              <select
                className="h-14 rounded-xl border bg-background px-3 text-base text-foreground transition-colors duration-200"
                value={t.tindakan}
                disabled={!bisaUbah}
                onChange={(e) => onUbah(t.checklistItemId, { tindakanRekomendasi: e.target.value as TindakanRekomendasi })}
              >
                {TINDAKAN_REKOMENDASI.map((k) => (
                  <option key={k} value={k}>
                    {LABEL_TINDAKAN[k]}
                  </option>
                ))}
              </select>
            </label>
            <UraianTindakan
              awal={jawaban[t.checklistItemId]?.uraianTindakan ?? ""}
              bisaUbah={bisaUbah}
              onSimpan={(v) => onUbah(t.checklistItemId, { uraianTindakan: v.trim() || null })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function UraianTindakan({ awal, bisaUbah, onSimpan }: { awal: string; bisaUbah: boolean; onSimpan: (v: string) => void }) {
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <Input
      aria-label="Uraian tindakan"
      placeholder="Uraian tindakan (opsional)"
      defaultValue={awal}
      maxLength={500}
      disabled={!bisaUbah}
      className="h-14 text-base"
      onChange={(e) => {
        clearTimeout(t.current);
        const v = e.target.value;
        t.current = setTimeout(() => onSimpan(v), 500);
      }}
      onBlur={(e) => {
        clearTimeout(t.current);
        onSimpan(e.target.value);
      }}
    />
  );
}
