"use client";

import { ChevronRight, CircleAlert, CircleCheck, CloudUpload, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KosongModul } from "@/components/ilustrasi/modul";
import { KerangkaKartu } from "@/components/shell/kerangka-muat";
import { Button } from "@/components/ui/button";
import { formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusAntrean } from "../client/status";
import { Cip, GambarAset, JudulBagian, KARTU, Kartu, Pita } from "./a";
import { useInspektur } from "./konteks";

export function formatUkuran(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
  return `${(b / 1024 ** 3).toLocaleString("id-ID", { maximumFractionDigits: 1 })} GB`;
}

/** Ruang penyimpanan perangkat (PWA-PLAN: storage.estimate + persist). */
export function useRuang() {
  const [r, setR] = useState<{ pakai: number; kuota: number; tetap: boolean | null } | null>(null);
  useEffect(() => {
    let hidup = true;
    (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => null);
      const tetap = (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
      if (hidup && est) setR({ pakai: est.usage ?? 0, kuota: est.quota ?? 0, tetap });
    })();
    return () => {
      hidup = false;
    };
  }, []);
  return r;
}

/** Peringatan bila sisa ruang kurang dari 200 MB (SPEC: peringatan ruang hampir habis). */
export const BATAS_RUANG_RENDAH = 200 * 1024 * 1024;

export function Antrean() {
  const { data, daring, siap, kirimSekarang } = useInspektur();
  const [now, setNow] = useState(() => Date.now());
  const [mengirim, setMengirim] = useState(false);
  const ruang = useRuang();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const asetById = useMemo(() => new Map((data.paket?.aset ?? []).map((a) => [a.id, a])), [data.paket]);
  const antrean = data.drafts.filter((d) => d.status !== "draf");
  const daftar = antrean.map((d) => ({ d, st: statusAntrean(d, data.ops, data.fotoPerInspeksi[d.inspectionId], daring, now) }));
  const macet = daftar.filter((x) => x.st.perluTindakan);
  const foto = Object.entries(data.fotoPerInspeksi)
    .filter(([id]) => antrean.some((d) => d.inspectionId === id))
    .reduce((s, [, f]) => ({ total: s.total + f.total, terunggah: s.terunggah + f.terunggah }), { total: 0, terunggah: 0 });

  if (!siap) return <KerangkaKartu label="Memuat antrean di perangkat…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Antrean kirim</h1>
        <p className="text-sm text-muted-foreground">Inspeksi tersimpan di ponsel sampai peladen menerimanya.</p>
      </div>

      {antrean.length === 0 ? (
        <Pita nada="ok" ikon={<CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />} judul="Semua terkirim" data-testid="status-sinkron">
          {data.paketDiperbarui ? `Data stiker diperbarui ${formatWaktu(data.paketDiperbarui)}.` : "Belum ada inspeksi di antrean."}
        </Pita>
      ) : macet.length > 0 ? (
        <Pita nada="bad" ikon={<CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />} judul={`${macet.length} inspeksi perlu tindakan`} data-testid="status-sinkron">
          Buka inspeksinya, perbaiki, lalu kirim lagi. Yang lain tetap dikirim.
        </Pita>
      ) : daring ? (
        <Pita nada="info" ikon={<CloudUpload className="mt-0.5 size-5 shrink-0" aria-hidden />} judul={`Mengirim ${antrean.length} inspeksi`} data-testid="status-sinkron">
          {foto.total > 0 ? `${foto.terunggah} dari ${foto.total} foto terunggah. ` : ""}Biarkan aplikasi terbuka sebentar.
        </Pita>
      ) : (
        <Pita nada="warn" ikon={<WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />} judul={`Luring · ${antrean.length} menunggu sinyal`} data-testid="status-sinkron">
          Semua tersimpan di ponsel ini dan dikirim otomatis saat ada sinyal. Jangan keluar dari akun.
        </Pita>
      )}

      {antrean.length > 0 && (
        <section className="space-y-2" aria-label="Daftar antrean">
          <JudulBagian judul="Di antrean" kanan={antrean.length} />
          <ul className={cn(KARTU, "divide-y divide-border/70 px-4")}>
            {daftar.map(({ d, st }) => {
              const a = asetById.get(d.assetId);
              const f = data.fotoPerInspeksi[d.inspectionId];
              return (
                <li key={d.inspectionId}>
                  <a href={`/petugas/isi?id=${d.inspectionId}`} className="flex min-h-16 items-center gap-3 py-3">
                    {a && <GambarAset aset={a} />}
                    <span className="min-w-0 flex-1">
                      <b className="block">{a?.kode ?? "Aset"}</b>
                      <span className="block text-sm text-muted-foreground">
                        Dikirim {formatWaktu(d.submittedAtDevice)}
                        {f?.total ? ` · ${f.total} foto` : ""}
                      </span>
                      {f && f.total > 0 && f.terunggah < f.total && daring && !st.perluTindakan && (
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className="block h-full bg-info" style={{ width: `${(f.terunggah / f.total) * 100}%` }} />
                        </span>
                      )}
                    </span>
                    <Cip nada={st.nada === "danger" ? "bad" : "info"} data-testid="status-antrean" className="max-w-[45%] truncate">
                      {st.label}
                    </Cip>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
          <Button
            variant="outline"
            className="h-12 w-full"
            disabled={mengirim}
            onClick={async () => {
              setMengirim(true);
              await kirimSekarang().finally(() => setMengirim(false));
            }}
          >
            <RefreshCw className={cn("size-4", mengirim && "animate-spin")} aria-hidden /> Kirim sekarang
          </Button>
        </section>
      )}

      {antrean.length === 0 && (
        <div className={KARTU}>
          <KosongModul modul="apar" judul="Tidak ada yang menunggu" isi="Inspeksi baru muncul di sini sampai terkirim, termasuk saat tanpa sinyal." />
        </div>
      )}

      <Kartu className="divide-y divide-border/70 py-1 text-sm" data-testid="ruang-perangkat">
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-muted-foreground">Data aplikasi di ponsel</span>
          <b className="tabular-nums">{ruang ? formatUkuran(ruang.pakai) : "—"}</b>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-muted-foreground">Ruang tersedia</span>
          <b className={cn("tabular-nums", ruang && ruang.kuota - ruang.pakai < BATAS_RUANG_RENDAH && "text-danger")}>
            {ruang ? formatUkuran(Math.max(0, ruang.kuota - ruang.pakai)) : "—"}
          </b>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-muted-foreground">Penyimpanan permanen</span>
          <span>{ruang?.tetap ? "Aktif" : ruang?.tetap === false ? "Belum (pasang aplikasi)" : "—"}</span>
        </div>
        <p className="py-3 text-muted-foreground">Foto dihapus dari ponsel setelah peladen menerima inspeksinya.</p>
      </Kartu>
      {ruang && ruang.kuota - ruang.pakai < BATAS_RUANG_RENDAH && (
        <Pita nada="bad" ikon={<CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />} judul="Ruang ponsel hampir habis">
          Kirim antrean saat ada sinyal dan kosongkan ruang ponsel sebelum memotret lagi.
        </Pita>
      )}
    </div>
  );
}
