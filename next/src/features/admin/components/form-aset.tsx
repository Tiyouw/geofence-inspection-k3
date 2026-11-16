"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LABEL_LOKASI, LOKASI_TIPE, RADIUS_PER_LOKASI, type LokasiTipe } from "@/lib/domain/constants";
import { keteranganJenisLokasi } from "../lib/label";
import type { HasilAksi } from "../server/aksi";
import { Peta } from "./peta";
import { Bidang, Pilihan } from "./ui";
import { useFormAksi } from "./use-form-aksi";

type NilaiAset = {
  assetTypeId?: number;
  kode?: string;
  divisionId?: number | null;
  aktif?: boolean;
  gedung?: string | null;
  lantai?: string | null;
  lokasiTeks?: string;
  lokasiTipe?: LokasiTipe;
  lat?: number | null;
  lng?: number | null;
  radiusM?: number | null;
  tglExpired?: string | null;
  terakhirDicek?: string | null;
  jenis?: string;
  kapasitasKg?: number | null;
};

/** Formulir aset (H2). Token tidak ada di formulir: hanya lewat aksi "Ganti token" (C7). */
export function FormAset({
  aksi,
  nilai = {},
  tipe,
  divisi,
  gedung,
  labelKirim,
  terakhirDicekLabel,
}: {
  aksi: (prev: unknown, fd: FormData) => Promise<HasilAksi<{ id: number } | undefined>>;
  nilai?: NilaiAset;
  tipe: { id: number; nama: string }[];
  divisi: { id: number; nama: string }[];
  gedung: string[];
  labelKirim: string;
  terakhirDicekLabel?: string;
}) {
  const router = useRouter();
  const { state, onSubmit, menunggu } = useFormAksi(aksi, {
    setelahBerhasil: (r) => {
      if (r.ok && r.data && "id" in r.data) router.push(`/admin/aset/${r.data.id}`);
    },
  });
  const [lokasiTipe, setLokasiTipe] = useState<LokasiTipe>(nilai.lokasiTipe ?? "dalam_gedung");
  const [lat, setLat] = useState(nilai.lat != null ? String(nilai.lat) : "");
  const [lng, setLng] = useState(nilai.lng != null ? String(nilai.lng) : "");
  const [radius, setRadius] = useState(nilai.radiusM != null ? String(nilai.radiusM) : "");


  const g = (k: string) => (state && !state.ok ? state.galat?.[k] : undefined);
  const inv = (k: string) => (g(k) ? { "aria-invalid": true, "aria-describedby": `${k}-galat` } : {});
  const titik = Number.isFinite(parseFloat(lat.replace(",", "."))) && Number.isFinite(parseFloat(lng.replace(",", ".")))
    ? { lat: parseFloat(lat.replace(",", ".")), lng: parseFloat(lng.replace(",", ".")) }
    : null;
  const radiusTampil = Number(radius) || RADIUS_PER_LOKASI[lokasiTipe];

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.pesan}
        </p>
      )}

      <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Identitas</legend>
        <Bidang label="Tipe objek" htmlFor="assetTypeId" galat={g("assetTypeId")}>
          <Pilihan id="assetTypeId" name="assetTypeId" defaultValue={nilai.assetTypeId ?? tipe[0]?.id} required {...inv("assetTypeId")}>
            {tipe.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama}
              </option>
            ))}
          </Pilihan>
        </Bidang>
        <Bidang label="Nomor aset" htmlFor="kode" galat={g("kode")} bantuan="Contoh: 01D. Unik per tipe objek.">
          <Input id="kode" name="kode" defaultValue={nilai.kode} required maxLength={32} {...inv("kode")} />
        </Bidang>
        <Bidang label="Divisi" htmlFor="divisionId" galat={g("divisionId")}>
          <Pilihan id="divisionId" name="divisionId" defaultValue={nilai.divisionId ?? ""}>
            <option value="">Tanpa divisi</option>
            {divisi.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </Pilihan>
        </Bidang>
        <div className="flex items-center gap-2 self-end pb-1.5">
          <Checkbox id="aktif" name="aktif" defaultChecked={nilai.aktif ?? true} />
          <label htmlFor="aktif" className="text-sm">
            Aktif <span className="text-muted-foreground">(aset nonaktif tidak dihitung kepatuhan)</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Penempatan</legend>
        <Bidang label="Gedung" htmlFor="gedung" galat={g("gedung")}>
          <Input id="gedung" name="gedung" list="daftar-gedung" defaultValue={nilai.gedung ?? ""} maxLength={64} {...inv("gedung")} />
          <datalist id="daftar-gedung">
            {gedung.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Bidang>
        <Bidang label="Lantai" htmlFor="lantai" galat={g("lantai")} bantuan='Angka saja ("2") atau "-" untuk area tanpa lantai.'>
          <Input id="lantai" name="lantai" defaultValue={nilai.lantai ?? ""} maxLength={16} {...inv("lantai")} />
        </Bidang>
        <Bidang label="Uraian lokasi" htmlFor="lokasiTeks" galat={g("lokasiTeks")} className="sm:col-span-2">
          <Input id="lokasiTeks" name="lokasiTeks" defaultValue={nilai.lokasiTeks} required maxLength={255} {...inv("lokasiTeks")} />
        </Bidang>
        <Bidang label="Jenis lokasi" htmlFor="lokasiTipe" galat={g("lokasiTipe")} bantuan={keteranganJenisLokasi(lokasiTipe)} className="sm:col-span-2">
          <Pilihan id="lokasiTipe" name="lokasiTipe" value={lokasiTipe} onChange={(e) => setLokasiTipe(e.target.value as LokasiTipe)}>
            {LOKASI_TIPE.map((l) => (
              <option key={l} value={l}>
                {LABEL_LOKASI[l]}
              </option>
            ))}
          </Pilihan>
        </Bidang>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Titik koordinat</legend>
        <p className="text-sm text-muted-foreground sm:col-span-3">
          Klik peta untuk menempatkan titik, atau ketik koordinat. Kosong berarti gerbang GPS dilewati (tanpa GPS).
        </p>
        <Bidang label="Lintang" htmlFor="lat" galat={g("lat")}>
          <Input id="lat" name="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} {...inv("lat")} />
        </Bidang>
        <Bidang label="Bujur" htmlFor="lng" galat={g("lng")}>
          <Input id="lng" name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} {...inv("lng")} />
        </Bidang>
        <Bidang label="Radius khusus (m)" htmlFor="radiusM" galat={g("radiusM")} bantuan="5–500 m. Kosong = ikut jenis lokasi.">
          <Input id="radiusM" name="radiusM" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} {...inv("radiusM")} />
        </Bidang>
        <div className="sm:col-span-3">
          <Peta
            titik={[]}
            pilih={titik}
            radius={radiusTampil}
            onPilih={(p) => {
              setLat(String(p.lat));
              setLng(String(p.lng));
            }}
            tinggi={320}
            label="Peta pemilih titik aset"
          />
          {titik && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setLat("");
                setLng("");
              }}
            >
              Hapus titik
            </Button>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Riwayat dan atribut</legend>
        <Bidang label="Jenis media" htmlFor="jenis" galat={g("jenis")} bantuan="Mis. Powder, CO2, Foam.">
          <Input id="jenis" name="jenis" defaultValue={nilai.jenis ?? ""} maxLength={32} />
        </Bidang>
        <Bidang label="Kapasitas (kg)" htmlFor="kapasitasKg" galat={g("kapasitasKg")}>
          <Input id="kapasitasKg" name="kapasitasKg" inputMode="decimal" defaultValue={nilai.kapasitasKg ?? ""} {...inv("kapasitasKg")} />
        </Bidang>
        <Bidang label="Tanggal kedaluwarsa" htmlFor="tglExpired" galat={g("tglExpired")}>
          <Input id="tglExpired" name="tglExpired" type="date" defaultValue={nilai.tglExpired ?? ""} />
        </Bidang>
        <Bidang label="Terakhir dicek" htmlFor="terakhirDicek" bantuan="Diisi otomatis saat inspeksi difinalkan.">
          <Input id="terakhirDicek" value={terakhirDicekLabel ?? "Belum pernah"} readOnly disabled />
        </Bidang>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/aset")}>
          Batal
        </Button>
        <Button type="submit" variant="brand" disabled={menunggu}>
          {menunggu ? "Menyimpan…" : labelKirim}
        </Button>
      </div>
    </form>
  );
}
