"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import type { GeometriArea } from "@/lib/geo/geometri";
import type { HasilAksi } from "../server/aksi";
import { Peta } from "./peta";
import { Bidang, Pilihan } from "./ui";
import { useFormAksi } from "./use-form-aksi";

type NilaiAset = {
    assetTypeId?: number;
    kode?: string;
    divisionId?: number | null;
    aktif?: boolean;
    areaId?: number | null;
    lantai?: string | null;
    lokasiTeks?: string;
    lat?: number | null;
    lng?: number | null;
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
    area,
    labelKirim,
    terakhirDicekLabel,
    kawasan = null,
}: {
    aksi: (prev: unknown, fd: FormData) => Promise<HasilAksi<{ id: number } | undefined>>;
    nilai?: NilaiAset;
    tipe: { id: number; nama: string }[];
    divisi: { id: number; nama: string }[];
    area: { id: number; nama: string; polygon: GeometriArea | null; polygonDraf: GeometriArea | null }[];
    labelKirim: string;
    terakhirDicekLabel?: string;
    /** Kotak batas kawasan disetujui: peta pemilih dibuka pas di galangan. */
    kawasan?: [[number, number], [number, number]] | null;
}) {
    const router = useRouter();
    const { state, onSubmit, menunggu } = useFormAksi(aksi, {
        setelahBerhasil: (r) => {
            if (r.ok && r.data && "id" in r.data) router.push(`/admin/aset/${r.data.id}`);
        },
    });
    const [areaId, setAreaId] = useState(nilai.areaId != null ? String(nilai.areaId) : "");
    const [lat, setLat] = useState(nilai.lat != null ? String(nilai.lat) : "");
    const [lng, setLng] = useState(nilai.lng != null ? String(nilai.lng) : "");

    const g = (k: string) => (state && !state.ok ? state.galat?.[k] : undefined);
    const inv = (k: string) => (g(k) ? { "aria-invalid": true, "aria-describedby": `${k}-galat` } : {});
    const titik =
        Number.isFinite(parseFloat(lat.replace(",", "."))) && Number.isFinite(parseFloat(lng.replace(",", ".")))
            ? { lat: parseFloat(lat.replace(",", ".")), lng: parseFloat(lng.replace(",", ".")) }
            : null;
    const areaPilih = area.find((x) => String(x.id) === areaId) ?? null;

    return (
        <form onSubmit={onSubmit} className="grid gap-6" noValidate>
            <PesanMuncul
                role="alert"
                pesan={state && !state.ok ? state.pesan : undefined}
                celah="1.5rem"
                isiClassName="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
            />

            <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
                <legend className="px-1 text-sm font-semibold">Identitas</legend>
                <Bidang label="Tipe objek" htmlFor="assetTypeId" galat={g("assetTypeId")}>
                    <Pilihan
                        id="assetTypeId"
                        name="assetTypeId"
                        defaultValue={nilai.assetTypeId ?? tipe[0]?.id}
                        required
                        {...inv("assetTypeId")}
                    >
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
                <Bidang
                    label="Area"
                    htmlFor="areaId"
                    galat={g("areaId")}
                    bantuan={
                        areaPilih && !areaPilih.polygon
                            ? "Poligon area ini belum disetujui: inspeksi akan ditandai perlu tinjauan."
                            : "Gedung, bengkel, dok, atau dermaga. Gerbang lokasi memakai poligonnya."
                    }
                >
                    <Pilihan id="areaId" name="areaId" value={areaId} onChange={(e) => setAreaId(e.target.value)} {...inv("areaId")}>
                        <option value="">Belum dipasangkan</option>
                        {area.map((x) => (
                            <option key={x.id} value={x.id}>
                                {x.nama}
                            </option>
                        ))}
                    </Pilihan>
                </Bidang>
                <Bidang
                    label="Lantai"
                    htmlFor="lantai"
                    galat={g("lantai")}
                    bantuan='Angka saja ("2") atau "-" untuk area tanpa lantai.'
                >
                    <Input
                        id="lantai"
                        name="lantai"
                        defaultValue={nilai.lantai ?? ""}
                        maxLength={16}
                        {...inv("lantai")}
                    />
                </Bidang>
                <Bidang label="Uraian lokasi" htmlFor="lokasiTeks" galat={g("lokasiTeks")} className="sm:col-span-2">
                    <Input
                        id="lokasiTeks"
                        name="lokasiTeks"
                        defaultValue={nilai.lokasiTeks}
                        required
                        maxLength={255}
                        {...inv("lokasiTeks")}
                    />
                </Bidang>
            </fieldset>

            <fieldset className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
                <legend className="px-1 text-sm font-semibold">Titik koordinat</legend>
                <p className="text-sm text-muted-foreground sm:col-span-3">
                    Klik peta untuk menempatkan titik, atau ketik koordinat. Titik membantu petugas menemukan aset;
                    gerbang lokasi memakai poligon area.
                </p>
                <Bidang label="Lintang" htmlFor="lat" galat={g("lat")}>
                    <Input
                        id="lat"
                        name="lat"
                        inputMode="decimal"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        {...inv("lat")}
                    />
                </Bidang>
                <Bidang label="Bujur" htmlFor="lng" galat={g("lng")}>
                    <Input
                        id="lng"
                        name="lng"
                        inputMode="decimal"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        {...inv("lng")}
                    />
                </Bidang>
                <div className="sm:col-span-3">
                    <Peta
                        titik={[]}
                        pilih={titik}
                        poligon={
                            (areaPilih?.polygon ?? areaPilih?.polygonDraf)
                                ? [{ geojson: (areaPilih.polygon ?? areaPilih.polygonDraf)!, judul: areaPilih.nama, warna: "info" }]
                                : []
                        }
                        onPilih={(p) => {
                            setLat(String(p.lat));
                            setLng(String(p.lng));
                        }}
                        kawasan={kawasan}
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
                    <Input
                        id="kapasitasKg"
                        name="kapasitasKg"
                        inputMode="decimal"
                        defaultValue={nilai.kapasitasKg ?? ""}
                        {...inv("kapasitasKg")}
                    />
                </Bidang>
                <Bidang label="Tanggal kedaluwarsa" htmlFor="tglExpired" galat={g("tglExpired")}>
                    <Input id="tglExpired" name="tglExpired" type="date" defaultValue={nilai.tglExpired ?? ""} />
                </Bidang>
                <Bidang
                    label="Terakhir dicek"
                    htmlFor="terakhirDicek"
                    bantuan="Diisi otomatis saat inspeksi difinalkan."
                >
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
