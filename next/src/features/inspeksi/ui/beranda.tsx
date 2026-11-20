"use client";

import { ChevronRight, CircleCheck, CloudUpload, ScanLine, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KosongModul } from "@/components/ilustrasi/modul";
import { KerangkaKartu } from "@/components/shell/kerangka-muat";
import { formatTanggal, formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusAntrean } from "../client/status";
import type { AsetPaket } from "../client/types";
import { Cip, GambarAset, JudulBagian, KARTU, Kartu, KONTROL, Pita, lokasiAset } from "./a";
import { useInspektur } from "./konteks";
import { LencanaGerbang, LencanaKesimpulan, LencanaModeDemo } from "./lencana";
import { AjakanPasang } from "./pasang-aplikasi";
import { TautanLapangan } from "./tautan";

/** Daftar belum diperiksa dipotong supaya beranda tetap ringkas; urut tenggat terdekat dulu. */
const TAMPIL_AWAL = 8;

const tgl = (d: string, o: Intl.DateTimeFormatOptions) => formatTanggal(`${d}T12:00:00+07:00`, o);

/** Sisa hari sampai akhir hari tenggat (WIB). */
function sisaHari(tenggat: string, now: number) {
  return Math.ceil((new Date(`${tenggat}T23:59:59+07:00`).getTime() - now) / 86_400_000);
}

function labelTenggat(sisa: number): { teks: string; nada: "bad" | "warn" | "mut" } {
  if (sisa < 0) return { teks: `Lewat ${-sisa} hari`, nada: "bad" };
  if (sisa === 0) return { teks: "Hari ini", nada: "warn" };
  if (sisa === 1) return { teks: "Besok", nada: "mut" };
  return { teks: `${sisa} hari lagi`, nada: "mut" };
}

export function Beranda({ namaDepan }: { namaDepan: string }) {
  const { data, daring, siap } = useInspektur();
  const [now, setNow] = useState(() => Date.now());
  const [semua, setSemua] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const paket = data.paket;
  const asetById = useMemo(() => new Map((paket?.aset ?? []).map((a) => [a.id, a])), [paket]);
  const draf = data.drafts.filter((d) => d.status === "draf");
  const antrean = data.drafts.filter((d) => d.status !== "draf");

  const periode = paket?.periode;
  const bulanIni = periode?.mulai.slice(0, 7);
  const sentBulanIni = data.sent.filter((s) => bulanIni && s.inspectedAt.slice(0, 7) >= bulanIni);
  const sudah = new Set([...(paket?.sudahDiperiksa ?? []), ...sentBulanIni.map((s) => s.assetId), ...antrean.map((d) => d.assetId)]);
  const belum = (paket?.aset ?? []).filter((a) => !sudah.has(a.id));
  const total = paket?.aset.length ?? 0;
  const tenggatAset = (a: AsetPaket) => periode?.jatuhTempo[a.assetTypeId];
  const belumUrut = [...belum].sort((a, b) => (tenggatAset(a) ?? "9").localeCompare(tenggatAset(b) ?? "9") || a.kode.localeCompare(b.kode));
  const lewat = belum.filter((a) => {
    const t = tenggatAset(a);
    return t ? sisaHari(t, now) < 0 : false;
  });
  const tenggatTerdekat = Object.values(periode?.jatuhTempo ?? {}).sort()[0];
  const sisaPeriode = tenggatTerdekat ? sisaHari(tenggatTerdekat, now) : null;
  const persen = total ? Math.round(((total - belum.length) / total) * 100) : 0;
  const perluTindakan = antrean.filter((d) => statusAntrean(d, data.ops, data.fotoPerInspeksi[d.inspectionId], daring, now).perluTindakan);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{paket?.unit ? `${namaDepan} · ${paket.unit}` : namaDepan}</p>
          <h1 className="text-2xl font-bold tracking-tight">{formatTanggal(new Date(), { weekday: "long", day: "numeric", month: "long" })}</h1>
        </div>
      </div>

      {!siap ? (
        <KerangkaKartu label="Memuat data di perangkat…" />
      ) : !paket ? (
        <Kartu className="text-sm">{daring ? "Mengunduh data stiker…" : "Data stiker belum diunduh. Buka aplikasi sekali saat ada sinyal."}</Kartu>
      ) : (
        <Kartu className="space-y-3" data-tur="progres">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Periode {tgl(periode!.mulai, { month: "long", year: "numeric" })}</p>
              <p className="text-[26px] leading-tight font-bold tracking-tight tabular-nums" data-testid="progres">
                {total - belum.length} / {total} aset
              </p>
            </div>
            <Cip nada={belum.length ? "info" : "ok"}>{belum.length ? `${belum.length} tersisa` : "Selesai"}</Cip>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Aset sudah diperiksa"
            aria-valuenow={persen}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-success transition-[width] duration-(--durasi-lambat)" style={{ width: `${persen}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {sisaPeriode !== null && (
              <span className={cn(sisaPeriode < 0 && "font-semibold text-danger")}>
                {sisaPeriode < 0
                  ? "Tenggat periode terlewat"
                  : `Sisa ${sisaPeriode} hari (tenggat ${tgl(tenggatTerdekat!, { day: "numeric", month: "short" })})`}
              </span>
            )}
            <span>Inspeksi Anda bulan ini: {sentBulanIni.length}</span>
          </div>
        </Kartu>
      )}

      {lewat.length > 0 && (
        <Pita nada="bad" ikon={<Timer className="mt-0.5 size-5 shrink-0" aria-hidden />} judul={`${lewat.length} aset lewat tenggat`}>
          {lewat
            .slice(0, 3)
            .map((a) => a.kode)
            .join(", ")}
          {lewat.length > 3 ? ` dan ${lewat.length - 3} lainnya` : ""}. Periksa lebih dulu.
        </Pita>
      )}

      <TautanLapangan
        href="/petugas/pindai"
        className={cn(KONTROL, "flex h-14 items-center justify-center gap-2.5 bg-brand text-base font-bold text-brand-foreground shadow-sm transition-colors hover:bg-brand-hover")}
      >
        <ScanLine className="size-6" aria-hidden /> Pindai stiker
      </TautanLapangan>

      <AjakanPasang />

      {antrean.length > 0 && (
        <TautanLapangan href="/petugas/antrean" className={cn(KARTU, "flex items-center gap-3 p-4")}>
          <CloudUpload className={cn("size-6 shrink-0", perluTindakan.length ? "text-danger" : "text-info")} aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="block">{perluTindakan.length ? `${perluTindakan.length} perlu tindakan` : `${antrean.length} inspeksi di antrean kirim`}</b>
            <span className="block text-sm text-muted-foreground">
              {daring ? "Dikirim otomatis. Ketuk untuk melihat." : "Menunggu sinyal. Tersimpan aman di ponsel."}
            </span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </TautanLapangan>
      )}

      {draf.length > 0 && (
        <section className="space-y-2" aria-label="Belum dikirim">
          <JudulBagian judul="Lanjutkan draf" kanan={draf.length} />
          <ul className={cn(KARTU, "divide-y divide-border/70 px-4")}>
            {draf.map((d) => {
              const a = asetById.get(d.assetId);
              return (
                <li key={d.inspectionId}>
                  <TautanLapangan href={`/petugas/isi?id=${d.inspectionId}`} className="flex min-h-16 items-center gap-3 py-3">
                    {a && <GambarAset aset={a} />}
                    <span className="min-w-0 flex-1">
                      <b className="block">{a?.kode ?? "Aset"}</b>
                      <span className="block truncate text-sm text-muted-foreground">{a ? lokasiAset(a) : ""}</span>
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">{Object.keys(d.jawaban).length} terisi</span>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </TautanLapangan>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {paket && (
        <section className="space-y-2" aria-label="Belum diperiksa bulan ini">
          <JudulBagian judul="Belum diperiksa" kanan={`${belum.length} dari ${total}`} />
          {belum.length === 0 ? (
            <div className={KARTU}>
              <KosongModul modul="apar" judul="Semua aset sudah diperiksa periode ini." isi="Terima kasih. Aset baru atau periode berikutnya akan muncul di sini." />
            </div>
          ) : (
            <ul className={cn(KARTU, "divide-y divide-border/70 px-4")}>
              {(semua ? belumUrut : belumUrut.slice(0, TAMPIL_AWAL)).map((a) => {
                const t = tenggatAset(a);
                const lb = t ? labelTenggat(sisaHari(t, now)) : null;
                return (
                  <li key={a.id} className="flex min-h-16 items-center gap-3 py-3">
                    <GambarAset aset={a} />
                    <span className="min-w-0 flex-1">
                      <b className="block">
                        {a.kode} <span className="font-normal text-muted-foreground">· {a.tipe}</span>
                      </b>
                      <span className="block truncate text-sm text-muted-foreground">{lokasiAset(a) || "Lokasi belum diisi"}</span>
                    </span>
                    {lb && <Cip nada={lb.nada}>{lb.teks}</Cip>}
                  </li>
                );
              })}
            </ul>
          )}
          {belum.length > TAMPIL_AWAL && (
            <button
              type="button"
              onClick={() => setSemua((x) => !x)}
              className={cn(KONTROL, "h-11 w-full border bg-card text-sm font-semibold")}
            >
              {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${belum.length})`}
            </button>
          )}
          {belum.length > 0 && <p className="px-0.5 text-sm text-muted-foreground">Formulir terbuka setelah stiker QR aset dipindai di lokasi.</p>}
        </section>
      )}

      {data.sent.length > 0 && (
        <section className="space-y-2" aria-label="Terkirim (30 hari)">
          <JudulBagian judul="Terkirim terakhir" kanan={<TautanLapangan href="/petugas/riwayat" className="font-semibold text-foreground underline-offset-4 hover:underline">Riwayat</TautanLapangan>} />
          <ul className={cn(KARTU, "divide-y divide-border/70 px-4")}>
            {data.sent.slice(0, 3).map((s) => (
              <li key={s.inspectionId} className="flex items-center gap-3 py-3">
                <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                <span className="min-w-0 flex-1">
                  <b className="block">{s.kode}</b>
                  <span className="block text-sm text-muted-foreground">{formatWaktu(s.inspectedAt)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  {s.kesimpulan && <LencanaKesimpulan k={s.kesimpulan} />}
                  <LencanaGerbang status={s.gateStatus} />
                  {s.gateAlasan === "mode_demo" && <LencanaModeDemo />}
                </span>
              </li>
            ))}
          </ul>
          {data.paketDiperbarui && <p className="px-0.5 text-xs text-muted-foreground">Data stiker diperbarui {formatWaktu(data.paketDiperbarui)}</p>}
        </section>
      )}
    </div>
  );
}
