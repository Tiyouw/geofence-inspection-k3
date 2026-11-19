"use client";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { Check, CircleCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { KerangkaKartu } from "@/components/shell/kerangka-muat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { KESIMPULAN, LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { bangunTemuan, isDuaNilai, labelDuaNilai, severityJawaban, terjawab, usulanKesimpulan } from "@/lib/domain/inspeksi";
import { isButirIsi, type KonteksP3k } from "@/lib/domain/modul/p3k";
import { pesanSinyalLemah } from "@/lib/geo/gerbang";
import { formatWaktu, hariIniJakarta } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  buangDraf,
  bukaKembali,
  butirUntuk,
  kirimInspeksi,
  langkahUntuk,
  simpanIsian,
  simpanJawaban,
} from "../client/aksi";
import { statusAntrean } from "../client/status";
import type { AsetPaket, DrafLokal } from "../client/types";
import { GambarAset, KARTU, KONTROL, lokasiAset } from "./a";
import { BuktiFoto } from "./bukti-foto";
import { IsianIsiP3k, type IsianIsi } from "./isian-isi-p3k";
import { useInspektur } from "./konteks";
import { KartuLokasi, useKeadaanLokasi } from "./kartu-lokasi";
import { LencanaGerbang, LencanaKesimpulan, LencanaModeDemo, LencanaSeverity } from "./lencana";
import { TemuanDraf } from "./temuan-draf";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TautanLapangan, pindahLapangan } from "./tautan";

export function Formulir({ inspectionId }: { inspectionId: string }) {
  const { db, data, daring, siap, berubah } = useInspektur();
  const draf = data.drafts.find((d) => d.inspectionId === inspectionId);
  const terkirim = data.sent.find((s) => s.inspectionId === inspectionId);

  if (!siap) return <KerangkaKartu baris={5} label="Memuat draf di perangkat…" />;
  if (terkirim && !draf) return <Terkirim id={inspectionId} />;
  if (!draf || !data.paket || !db) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-muted p-4 text-sm">Draf tidak ditemukan di perangkat ini. Pindai ulang stiker untuk memulai.</p>
        <Button asChild variant="brand">
          <TautanLapangan href="/petugas/pindai">Pindai stiker</TautanLapangan>
        </Button>
      </div>
    );
  }
  return <IsiDraf draf={draf} daring={daring} berubah={berubah} />;
}

function Terkirim({ id }: { id: string }) {
  const { data } = useInspektur();
  const s = data.sent.find((x) => x.inspectionId === id)!;
  return (
    <div className="space-y-5" data-testid="hasil-terkirim">
      <div className="flex items-start gap-4 rounded-[var(--a-radius-kartu,16px)] bg-success-soft p-5 text-success">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-success text-white">
          <Check className="size-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold">Inspeksi {s.kode} terkirim</h1>
          <p className="text-sm">Waktu resmi {formatWaktu(s.inspectedAt)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {s.kesimpulan && <LencanaKesimpulan k={s.kesimpulan} />}
        <LencanaGerbang status={s.gateStatus} />
        {s.gateAlasan === "mode_demo" && <LencanaModeDemo />}
      </div>
      {s.temuan && s.temuan.length > 0 && (
        <Card className="gap-0 rounded-[var(--a-radius-kartu,16px)] py-0">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">Temuan ({s.temuan.length})</p>
            <ul className="space-y-2">
              {s.temuan.map((t, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span>{t.item}</span>
                  <LencanaSeverity s={t.severity} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <AksiLanjut />
    </div>
  );
}

function AksiLanjut() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button asChild variant="brand" size="lg" className={cn(KONTROL, "h-14 text-base")}>
        <TautanLapangan href="/petugas/pindai">Pindai berikutnya</TautanLapangan>
      </Button>
      <Button asChild variant="outline" size="lg" className={cn(KONTROL, "h-14 text-base")}>
        <TautanLapangan href="/petugas">Ke beranda</TautanLapangan>
      </Button>
    </div>
  );
}

function IsiDraf(props: { draf: DrafLokal; daring: boolean; berubah: () => void }) {
  const { data } = useInspektur();
  const aset = data.paket!.aset.find((a) => a.id === props.draf.assetId);
  if (!aset) return <p className="text-sm">Aset untuk draf ini tidak ada di data stiker. Segarkan saat daring.</p>;
  return <IsiDrafAset {...props} aset={aset} />;
}

function IsiDrafAset({ draf, daring, berubah, aset }: { draf: DrafLokal; daring: boolean; berubah: () => void; aset: AsetPaket }) {
  const { db, data } = useInspektur();
  const router = useRouter();
  const paket = data.paket!;
  const grup = useMemo(() => paket.checklist[aset.assetTypeId] ?? [], [paket, aset]);
  const items = useMemo(() => butirUntuk(paket, aset.assetTypeId), [paket, aset]);
  const langkah = useMemo(() => langkahUntuk(paket, aset.assetTypeId), [paket, aset]);
  const labelButir = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.label])), [items]);
  const [galat, setGalat] = useState<string[]>([]);
  const [mengirim, setMengirim] = useState(false);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
  const bisaUbah = draf.status === "draf";

  const jawaban = Object.entries(draf.jawaban).map(([id, j]) => ({ ...j, checklistItemId: Number(id) }));
  // Kotak P3K: tipe kotak dari paket kerja, kedaluwarsa dinilai terhadap hari ini (WIB).
  const p3k = aset?.tipeKotak ? { tipeKotak: aset.tipeKotak, hariIni: hariIniJakarta() } : null;
  const temuan = bangunTemuan(items, jawaban, p3k);
  const usulan = usulanKesimpulan(temuan);
  const terisi = items.filter((i) => terjawab(i, jawaban.find((j) => j.checklistItemId === i.id))).length;

  // Gerbang lokasi (PRD, ADR-7): posisi diikuti, tanpa posisi = Kirim diblokir.
  const { status: statusGps, keadaan: lokasi } = useKeadaanLokasi(paket, aset, draf, bisaUbah, berubah);
  const [tanyaLemah, setTanyaLemah] = useState(false);

  const jawab = async (itemId: number, isi: IsianJawaban & { catatan?: string | null }) => {
    navigator.vibrate?.(30);
    await simpanJawaban(db!, draf.inspectionId, itemId, isi, items, p3k);
    berubah();
  };

  const kirim = async (abaikanLemah = false) => {
    if (!lokasi.bolehKirim) {
      setGalat([lokasi.alasanTidakKirim ?? "Lokasi belum diperoleh. Nyalakan Lokasi (GPS), lalu tekan Coba lagi."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (lokasi.lemah && !abaikanLemah) return setTanyaLemah(true);
    setMengirim(true);
    const r = await kirimInspeksi(db!, draf.inspectionId, items, { langkah, areaTerbatas: !!aset?.areaTerbatas, p3k });
    setMengirim(false);
    if (!r.ok) {
      setGalat(r.galat);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setGalat([]);
    berubah();
    window.scrollTo({ top: 0 });
  };

  const st = statusAntrean(draf, data.ops, data.fotoPerInspeksi[draf.inspectionId], daring);

  return (
    <div className={cn("space-y-5", bisaUbah && "pb-20")}>
      <div className="flex items-center gap-4">
        <GambarAset aset={aset} ukuran={76} />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {aset.tipe}
            {aset.media ? ` · ${aset.media}` : ""}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{aset.kode}</h1>
          <p className="text-sm text-muted-foreground">{lokasiAset(aset)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dipindai {formatWaktu(draf.scannedAtDevice)}
            {draf.qrVerification === "offline_cache" && " · dicocokkan luring"}
          </p>
        </div>
      </div>

      {bisaUbah && (
        <div aria-hidden>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{terisi < items.length ? "Isi checklist" : "Checklist lengkap · periksa foto lalu kirim"}</span>
            <span className="tabular-nums">
              {terisi} / {items.length} butir
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-[width] duration-(--durasi)" style={{ width: `${items.length ? (terisi / items.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {draf.status !== "draf" && (
        <div
          data-testid="status-kirim"
          className={cn("space-y-3 rounded-[var(--a-radius-kartu,16px)] p-4", st.perluTindakan ? "bg-danger-soft text-danger" : "bg-info-soft text-info")}
        >
          <p className="font-semibold">
            {st.perluTindakan ? "Perlu tindakan" : "Masuk antrean, akan dikirim otomatis saat ada sinyal"}
          </p>
          <p className="text-sm">{st.label}</p>
          {draf.status === "perlu_tindakan" ? (
            <Button
              variant="outline"
              onClick={async () => {
                await bukaKembali(db!, draf.inspectionId);
                berubah();
              }}
            >
              Buka kembali dan perbaiki
            </Button>
          ) : (
            <AksiLanjut />
          )}
        </div>
      )}

      <PesanMuncul
        role="alert"
        testId="galat-kirim"
        pesan={
          galat.length > 0 ? (
            <ul className="space-y-1">
              {galat.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : undefined
        }
        celah="1.25rem"
        className="my-0!"
        isiClassName="rounded-lg bg-danger-soft p-3 text-sm text-danger"
      />

      <KartuLokasi aset={aset} paket={paket} draf={draf} status={statusGps} keadaan={lokasi} bisaUbah={bisaUbah} />

      {grup.map((g) => (
        <section key={`${g.kode}-${g.nama}`} className="space-y-2" aria-label={g.nama}>
          <h2 className="px-0.5 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {g.kode ? `${g.kode}. ` : ""}
            {g.nama}
          </h2>
          <div className={cn(KARTU, "divide-y divide-border/70 px-4")}>
          {g.items.map((item) => {
            const jl = draf.jawaban[item.id];
            const j = jl ? { ...jl, checklistItemId: item.id } : undefined;
            const sev = severityJawaban(item, j) ?? temuan.find((t) => t.checklistItemId === item.id)?.severity ?? null;
            return (
              <div key={item.id} className="space-y-3 py-4" data-testid={`butir-${item.id}`}>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    {item.dasarHukum && <p className="text-xs text-muted-foreground">{item.dasarHukum}</p>}
                    {item.keterangan && <p className="mt-1 text-xs text-muted-foreground">{item.keterangan}</p>}
                  </div>
                  <IsianButir item={item} nilai={j} bisaUbah={bisaUbah} p3k={p3k} onJawab={(isi) => void jawab(item.id, isi)} />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={cn("inline-flex items-center gap-1", terjawab(item, j) ? "text-muted-foreground" : "font-medium text-warning")}>
                      {terjawab(item, j) && <CircleCheck className="size-3.5 text-success" aria-hidden />}
                      {terjawab(item, j) ? "Tersimpan di perangkat" : item.wajib ? "Wajib diisi" : ""}
                    </span>
                    {sev && <LencanaSeverity s={sev} />}
                  </div>
                  {bisaUbah && terjawab(item, j) && (
                    <CatatanButir awal={j?.catatan ?? ""} onSimpan={(c) => void jawab(item.id, { catatan: c })} />
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </section>
      ))}

      <BuktiFoto draf={draf} langkah={langkah} labelButir={labelButir} areaTerbatas={!!aset.areaTerbatas} bisaUbah={bisaUbah} />

      <section className="space-y-4" aria-label="Kesimpulan">
        <h2 className="px-0.5 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Kesimpulan</h2>
        {temuan.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {temuan.length} temuan. Usulan: <b>{LABEL_KESIMPULAN[usulan]}</b>
          </p>
        )}
        <TemuanDraf
          temuan={temuan}
          jawaban={draf.jawaban}
          bisaUbah={bisaUbah}
          onUbah={async (itemId, isi) => {
            await simpanJawaban(db!, draf.inspectionId, itemId, isi, items);
            berubah();
          }}
        />
        <div className="grid gap-2" role="radiogroup" aria-label="Kesimpulan">
          {KESIMPULAN.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draf.kesimpulan === k}
              disabled={!bisaUbah}
              onClick={async () => {
                await simpanIsian(db!, draf.inspectionId, { kesimpulan: k });
                berubah();
              }}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-[var(--a-radius-kontrol,10px)] border p-3 text-left text-base font-semibold",
                draf.kesimpulan === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border-2",
                  draf.kesimpulan === k ? "border-primary-foreground" : "border-muted-foreground/50",
                )}
              >
                {draf.kesimpulan === k && <span className="size-2.5 rounded-full bg-primary-foreground" />}
              </span>
              {LABEL_KESIMPULAN[k]}
            </button>
          ))}
        </div>
        <TeksDraf
          id="rekomendasi"
          label={temuan.length ? "Rekomendasi (wajib bila ada temuan)" : "Rekomendasi"}
          awal={draf.rekomendasi}
          bisaUbah={bisaUbah}
          onSimpan={async (v) => {
            await simpanIsian(db!, draf.inspectionId, { rekomendasi: v });
            berubah();
          }}
        />
        <TeksDraf
          id="catatan"
          label="Catatan"
          awal={draf.catatan}
          bisaUbah={bisaUbah}
          onSimpan={async (v) => {
            await simpanIsian(db!, draf.inspectionId, { catatan: v });
            berubah();
          }}
        />
      </section>

      {bisaUbah && (
        <Button
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            const ya = await konfirmasi({
              judul: "Buang draf ini?",
              isi: "Semua jawaban dan foto draf ini dihapus dari ponsel. Inspeksi belum terkirim, jadi tidak ada yang tercatat.",
              tombol: "Buang draf",
              bahaya: true,
            });
            if (!ya) return;
            await buangDraf(db!, draf.inspectionId);
            berubah();
            pindahLapangan(router, "/petugas");
          }}
        >
          Buang draf
        </Button>
      )}

      {bisaUbah && (
        <div className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[30rem] rounded-[var(--a-radius-kartu,16px)] border border-border/80 bg-card/95 shadow-[0_10px_24px_-14px_rgb(3_30_37/0.45)] backdrop-blur">
          <div className="flex items-center gap-3 py-2 pr-2 pl-4">
            <p className="flex-1 text-sm" data-testid="penghitung">
              Pemeriksaan terisi <b>{terisi}</b> / {items.length}
            </p>
            <Button
              variant="brand"
              size="lg"
              className={cn(KONTROL, "h-12 px-8 text-base font-bold")}
              onClick={() => void kirim()}
              disabled={mengirim || !lokasi.bolehKirim}
              aria-describedby={!lokasi.bolehKirim && lokasi.alasanTidakKirim ? "alasan-kirim" : undefined}
            >
              {mengirim ? "Menyimpan…" : "Kirim"}
            </Button>
          </div>
          {!lokasi.bolehKirim && lokasi.alasanTidakKirim && (
            <p id="alasan-kirim" className="border-t px-4 py-2 text-xs font-medium text-danger" data-testid="alasan-kirim" role="status">
              {lokasi.alasanTidakKirim}
            </p>
          )}
        </div>
      )}

      <AlertDialog open={tanyaLemah} onOpenChange={setTanyaLemah}>
        <AlertDialogContent data-testid="dialog-sinyal-lemah">
          <AlertDialogHeader>
            <AlertDialogTitle>Sinyal GPS lemah</AlertDialogTitle>
            <AlertDialogDescription>{pesanSinyalLemah(draf.gps?.accuracy ?? 999)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => lokasi.ambilUlang()}>Tunggu sinyal lebih baik</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTanyaLemah(false);
                void kirim(true);
              }}
            >
              Kirim sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {dialogKonfirmasi}
    </div>
  );
}

type IsianJawaban = { nilai?: string | null; nilaiAngka?: number | null } & IsianIsi;

function IsianButir({
  item,
  nilai,
  bisaUbah,
  p3k,
  onJawab,
}: {
  item: ReturnType<typeof butirUntuk>[number];
  nilai: DrafLokal["jawaban"][number] | undefined;
  bisaUbah: boolean;
  p3k: KonteksP3k | null;
  onJawab: (isi: IsianJawaban) => void;
}) {
  if (p3k && isButirIsi(item)) {
    return <IsianIsiP3k item={{ ...item, jumlahBaku: item.jumlahBakuPerTipe ?? null, hasExpiry: !!item.hasExpiry }} tipeKotak={p3k.tipeKotak} hariIni={p3k.hariIni} nilai={nilai} bisaUbah={bisaUbah} onJawab={onJawab} />;
  }
  const pilihan: { nilai: string; label: string; buruk: boolean }[] = isDuaNilai(item.answerType)
    ? [
        { nilai: "ok", label: labelDuaNilai(item.answerType).ok, buruk: false },
        { nilai: "tidak", label: labelDuaNilai(item.answerType).tidak, buruk: true },
      ]
    : item.answerType === "select"
      ? (item.options ?? []).map((o) => ({ nilai: o, label: o, buruk: !!item.severityMap?.[o] }))
      : [];

  if (pilihan.length) {
    return (
      <div className={cn("grid gap-2", pilihan.length === 2 ? "grid-cols-2" : "grid-cols-1 min-[420px]:grid-cols-2")} role="radiogroup" aria-label={item.label}>
        {pilihan.map((p) => {
          const aktif = nilai?.nilai === p.nilai;
          return (
            <button
              key={p.nilai}
              type="button"
              role="radio"
              aria-checked={aktif}
              disabled={!bisaUbah}
              onClick={() => onJawab({ nilai: p.nilai })}
              className={cn(
                "inline-flex min-h-13 items-center justify-center gap-1.5 rounded-[var(--a-radius-kontrol,10px)] border px-3 py-2 text-base font-semibold transition-colors duration-(--durasi-cepat)",
                aktif ? (p.buruk ? "border-danger bg-danger text-white" : "border-success bg-success text-white") : "border-border bg-card",
              )}
            >
              {pilihan.length === 2 && (p.buruk ? <X className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />)}
              {p.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (item.answerType === "number") {
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={nilai?.nilaiAngka ?? ""}
        disabled={!bisaUbah}
        aria-label={item.label}
        onChange={(e) => e.target.value !== "" && onJawab({ nilaiAngka: Number(e.target.value) })}
      />
    );
  }
  return (
    <Input
      type={item.answerType === "date" ? "date" : "text"}
      defaultValue={nilai?.nilai ?? ""}
      disabled={!bisaUbah}
      aria-label={item.label}
      maxLength={120}
      onChange={(e) => onJawab({ nilai: e.target.value })}
    />
  );
}

function CatatanButir({ awal, onSimpan }: { awal: string; onSimpan: (v: string) => void }) {
  const [buka, setBuka] = useState(!!awal);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (!buka) {
    return (
      <button type="button" className="text-xs font-medium text-info underline-offset-2 hover:underline" onClick={() => setBuka(true)}>
        Tambah catatan
      </button>
    );
  }
  return (
    <Textarea
      defaultValue={awal}
      maxLength={500}
      rows={2}
      placeholder="Catatan butir ini"
      onChange={(e) => {
        clearTimeout(t.current);
        const v = e.target.value;
        t.current = setTimeout(() => onSimpan(v), 900);
      }}
    />
  );
}

function TeksDraf({ id, label, awal, bisaUbah, onSimpan }: { id: string; label: string; awal: string; bisaUbah: boolean; onSimpan: (v: string) => void }) {
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        defaultValue={awal}
        maxLength={1000}
        rows={3}
        disabled={!bisaUbah}
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
    </div>
  );
}
