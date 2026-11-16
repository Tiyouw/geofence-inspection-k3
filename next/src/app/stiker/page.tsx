import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TombolCetak } from "@/features/admin/components/tombol-cetak";
import { Pilihan } from "@/features/admin/components/ui";
import { TATA_LETAK, bagiLembar, parseDaftarKode, parseTata, ukuranLabel, type KodeTata } from "@/features/admin/lib/stiker";
import { catatAudit } from "@/features/admin/server/aksi";
import { daftarGedung, pilihanAset } from "@/features/admin/server/aset";
import { asetStiker, qrSvg } from "@/features/admin/server/stiker";
import { db } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { labelLokasi } from "@/lib/domain/label-aset";

export const metadata: Metadata = { title: "Lembar Stiker QR" };

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Ukuran dalam milimeter, bukan piksel: hasil cetak harus pas di kertas label yang dipotong pabrik. */
function gaya(kode: KodeTata): string {
  const t = TATA_LETAK[kode];
  const { qrMm, kodeMm } = ukuranLabel(kode);
  return `
  .stiker-lembar { width: 210mm; min-height: 297mm; background: #fff; margin: 16px auto; padding: 8mm 5mm;
    display: grid; grid-template-columns: repeat(${t.kolom}, ${t.lebar}mm); grid-auto-rows: ${t.tinggi}mm;
    justify-content: center; align-content: start; box-shadow: 0 2px 10px rgba(0,0,0,.15); color: #000; }
  .stiker-label { width: ${t.lebar}mm; height: ${t.tinggi}mm; display: flex; align-items: center; gap: 2mm; padding: 2mm;
    overflow: hidden; outline: 1px dashed #ced4da; outline-offset: -1px; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  .stiker-qr { flex: 0 0 auto; line-height: 0; }
  .stiker-qr svg { display: block; width: ${qrMm}mm; height: auto; }
  .stiker-teks { flex: 1; min-width: 0; }
  .stiker-jenis { font-size: 2.4mm; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .stiker-kode { font-size: ${kodeMm}mm; font-weight: 800; letter-spacing: .2px; line-height: 1.1; }
  .stiker-lokasi { font-size: 2.5mm; line-height: 1.25; margin-top: .8mm; }
  .stiker-perintah { font-size: 2.3mm; margin-top: 1mm; font-weight: 600; }
  .stiker-token { font-family: ui-monospace, 'Courier New', monospace; font-size: 1.9mm; color: #495057;
    word-break: break-all; line-height: 1.2; margin-top: .6mm; }
  @media print {
    body { background: #fff !important; }
    .stiker-layar { display: none !important; }
    .stiker-lembar { margin: 0; box-shadow: none; padding: 8mm 5mm; break-after: page; }
    .stiker-lembar:last-child { break-after: auto; }
    .stiker-label { outline: none; }
    @page { size: A4 portrait; margin: 0; }
  }`;
}

/**
 * Lembar stiker QR untuk dicetak lewat dialog cetak peramban (SPEC §4.4, L7). Bukan PDF: pengelola
 * stiker perlu pratinjau dan memilih rentang halaman sendiri tanpa selisih milimeter.
 */
export default async function LembarStiker({ searchParams }: PageProps<"/stiker">) {
  const user = await requireRole("admin");
  const sp = await searchParams;
  const kodeTata = parseTata(satu(sp.tata));
  const tata = TATA_LETAK[kodeTata];
  const filter = { tipe: satu(sp.tipe), gedung: satu(sp.gedung), lantai: satu(sp.lantai), kode: parseDaftarKode(satu(sp.kode)) };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [aset, { tipe }, gedung] = await Promise.all([asetStiker(filter), pilihanAset(), daftarGedung()]);
  const label = await Promise.all(aset.map(async (a) => ({ ...a, svg: await qrSvg(origin, a.qrToken) })));
  const lembar = bagiLembar(label, tata.kolom * tata.baris);
  // Membuka lembar = melihat token semua aset terpilih: dicatat.
  await catatAudit(db, user, "stiker.lihat", "asset", "-", { jumlah: aset.length, tata: kodeTata, ...filter });

  return (
    <div className="min-h-dvh bg-muted">
      <style>{gaya(kodeTata)}</style>
      <header className="stiker-layar flex flex-wrap items-center justify-between gap-3 bg-primary px-5 py-3 text-primary-foreground">
        <h1 className="text-base font-semibold">Lembar Stiker QR</h1>
        <nav aria-label="Pindah halaman pengelolaan" className="flex gap-4 text-sm">
          <Link href="/admin" className="underline">
            Panel admin
          </Link>
          <Link href="/admin/aset" className="underline">
            Aset
          </Link>
          <Link href="/laporan" className="underline">
            Laporan bulanan
          </Link>
        </nav>
      </header>

      <div className="stiker-layar sticky top-0 z-10 border-b bg-card px-5 py-4">
        <form method="get" className="flex max-w-6xl flex-wrap items-end gap-3" aria-label="Saring stiker">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Tata letak label
            <Pilihan name="tata" defaultValue={kodeTata} className="min-w-64">
              {Object.entries(TATA_LETAK).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.nama}
                </option>
              ))}
            </Pilihan>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Jenis objek
            <Pilihan name="tipe" defaultValue={filter.tipe ?? ""}>
              <option value="">Semua</option>
              {tipe.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.nama}
                </option>
              ))}
            </Pilihan>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Gedung
            <Pilihan name="gedung" defaultValue={filter.gedung ?? ""}>
              <option value="">Semua</option>
              {gedung.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Pilihan>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Lantai
            <Input name="lantai" defaultValue={filter.lantai ?? ""} placeholder="mis. Lt. 2" className="w-28" />
          </label>
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs font-medium">
            Kode aset tertentu
            <Input name="kode" defaultValue={filter.kode.join(", ")} placeholder="01D, 14A" />
          </label>
          <Button type="submit">Terapkan</Button>
          <TombolCetak />
        </form>
        <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground">
          {aset.length} stiker pada {lembar.length} lembar. Tempelkan stiker di dinding tepat di atas dudukan objek, bukan pada badan
          tabung: tabung dapat dipindahkan atau ditukar saat pengisian ulang, sedangkan titik pemasangan tetap. Pada dialog cetak,
          matikan penskalaan (pilih Ukuran asli atau 100%) agar ukuran label tidak bergeser.
        </p>
      </div>

      {lembar.length === 0 ? (
        <div className="stiker-lembar" style={{ display: "block", padding: "20mm" }}>
          <p>Tidak ada aset yang cocok dengan penyaring. Longgarkan penyaring lalu terapkan ulang.</p>
        </div>
      ) : (
        lembar.map((isi, i) => (
          <section key={i} className="stiker-lembar" aria-label={`Lembar ${i + 1}`}>
            {isi.map((a) => (
              <div key={a.id} className="stiker-label" data-kode={a.kode}>
                {/* SVG dibuat peladen oleh pustaka qrcode dari URL /i/{token}; tidak memuat masukan pengguna. */}
                <div className="stiker-qr" dangerouslySetInnerHTML={{ __html: a.svg }} />
                <div className="stiker-teks">
                  <div className="stiker-jenis">{a.tipe || "Objek K3"}</div>
                  <div className="stiker-kode">{a.kode}</div>
                  <div className="stiker-lokasi">{labelLokasi(a)}</div>
                  <div className="stiker-perintah">Pindai sebelum memeriksa</div>
                  <div className="stiker-token">{a.qrToken}</div>
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
