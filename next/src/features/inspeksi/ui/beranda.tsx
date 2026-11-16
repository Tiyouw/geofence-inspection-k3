"use client";

import { ChevronRight, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { formatTanggal, formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusAntrean } from "../client/status";
import type { AsetPaket } from "../client/types";
import { useInspektur } from "./konteks";
import { LencanaGerbang, LencanaKesimpulan } from "./lencana";

function lokasi(a: AsetPaket) {
  return [a.lokasiTeks || a.gedung, a.lantai].filter(Boolean).join(" · ");
}

function Bagian({ judul, jumlah, children, aksi }: { judul: string; jumlah?: number; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-label={judul}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {judul}
          {jumlah !== undefined && <span className="ml-1 text-muted-foreground">({jumlah})</span>}
        </h2>
        {aksi}
      </div>
      {children}
    </section>
  );
}

export function Beranda({ namaDepan }: { namaDepan: string }) {
  const { data, daring, siap, kirimSekarang } = useInspektur();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
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
  const tenggat = periode ? Object.values(periode.jatuhTempo)[0] : undefined;
  const sisaHari = tenggat ? Math.ceil((new Date(`${tenggat}T23:59:59+07:00`).getTime() - now) / 86_400_000) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{formatTanggal(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {namaDepan}</h1>
      </div>

      <Button asChild variant="brand" size="lg" className="h-14 w-full text-base">
        {/* <a> biasa: navigasi penuh yang tetap jalan luring lewat service worker */}
        <a href="/petugas/pindai">
          <QrCode className="size-5" aria-hidden /> Pindai QR APAR
        </a>
      </Button>

      {!siap ? (
        <p className="text-sm text-muted-foreground">Memuat data di perangkat…</p>
      ) : !paket ? (
        <Card>
          <CardContent className="p-4 text-sm">
            {daring ? "Mengunduh data stiker…" : "Data stiker belum diunduh. Buka aplikasi sekali saat ada sinyal."}
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">Periode {formatTanggal(`${periode!.mulai}T12:00:00+07:00`, { month: "long", year: "numeric" })}</p>
              {sisaHari !== null && (
                <p className={cn("text-xs", sisaHari < 0 ? "font-semibold text-danger" : "text-muted-foreground")}>
                  {sisaHari < 0
                    ? "Tenggat periode terlewat"
                    : `Sisa ${sisaHari} hari (tenggat ${formatTanggal(`${tenggat}T12:00:00+07:00`, { day: "numeric", month: "short" })})`}
                </p>
              )}
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Sudah diperiksa</span>
                <span data-testid="progres">
                  {total - belum.length} / {total} aset
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full bg-success" style={{ width: `${total ? ((total - belum.length) / total) * 100 : 0}%` }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Inspeksi Anda bulan ini: {sentBulanIni.length}
              {data.paketDiperbarui && ` · Data stiker diperbarui ${formatWaktu(data.paketDiperbarui)}`}
            </p>
          </CardContent>
        </Card>
      )}

      {antrean.length > 0 && (
        <Bagian
          judul="Antrean kirim"
          jumlah={antrean.length}
          aksi={
            <Button size="sm" variant="outline" onClick={() => void kirimSekarang()}>
              <RefreshCw className="size-3.5" aria-hidden /> Kirim sekarang
            </Button>
          }
        >
          <ul className="divide-y rounded-xl border bg-card">
            {antrean.map((d) => {
              const a = asetById.get(d.assetId);
              const st = statusAntrean(d, data.ops, data.fotoPerInspeksi[d.inspectionId], daring, now);
              return (
                <li key={d.inspectionId}>
                  <a href={`/petugas/isi?id=${d.inspectionId}`} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{a?.kode ?? "Aset"}</p>
                      <p className="truncate text-xs text-muted-foreground">Dikirim {formatWaktu(d.submittedAtDevice)}</p>
                    </div>
                    <span
                      data-testid="status-antrean"
                      className={cn(
                        "rounded-md px-2 py-1 text-xs",
                        st.nada === "danger" ? "bg-danger-soft text-danger" : "bg-info-soft text-info",
                      )}
                    >
                      {st.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Bagian>
      )}

      {draf.length > 0 && (
        <Bagian judul="Belum dikirim" jumlah={draf.length}>
          <ul className="divide-y rounded-xl border bg-card">
            {draf.map((d) => {
              const a = asetById.get(d.assetId);
              return (
                <li key={d.inspectionId}>
                  <a href={`/petugas/isi?id=${d.inspectionId}`} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{a?.kode ?? "Aset"}</p>
                      <p className="truncate text-xs text-muted-foreground">{a ? lokasi(a) : ""}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(d.jawaban).length} terisi
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </Bagian>
      )}

      {paket && (
        <Bagian judul="Belum diperiksa bulan ini" jumlah={belum.length}>
          {belum.length === 0 ? (
            <p className="rounded-xl border bg-success-soft p-3 text-sm text-success">Semua aset sudah diperiksa periode ini.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {belum.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <span className="w-12 font-mono text-sm font-semibold">{a.kode}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{lokasi(a)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bagian>
      )}

      {data.sent.length > 0 && (
        <Bagian judul="Terkirim (30 hari)" jumlah={data.sent.length}>
          <ul className="divide-y rounded-xl border bg-card">
            {data.sent.map((s) => (
              <li key={s.inspectionId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.kode}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatWaktu(s.inspectedAt)}
                    {s.kesimpulan ? ` · ${LABEL_KESIMPULAN[s.kesimpulan]}` : ""}
                    {s.jumlahTemuan ? ` · ${s.jumlahTemuan} temuan` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {s.kesimpulan && <LencanaKesimpulan k={s.kesimpulan} />}
                  <LencanaGerbang status={s.gateStatus} />
                </div>
              </li>
            ))}
          </ul>
        </Bagian>
      )}
    </div>
  );
}
