import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tanggalIso, tglDmy, waktuDmyHm } from "@/features/laporan/format";
import { detailInspeksi } from "@/features/laporan/queries";
import { fotoPerButir } from "@/features/inspeksi/server/foto-butir";
import { FotoPerButir } from "@/features/inspeksi/ui/foto-per-butir";
import { labelLokasi, perluTinjauan } from "@/features/laporan/rakit";
import { Lencana, LencanaGerbang, LencanaKesimpulan, LABEL_STATUS_TEMUAN, NADA_TINGKAT, Tabel, labelNilai } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";
import { radiusEfektif } from "@/lib/domain/asset";
import { DURASI_WAJAR_DETIK } from "@/lib/domain/constants";
import { severityJawaban, simbolJawaban } from "@/lib/domain/jawaban";

export const metadata: Metadata = { title: "Detail inspeksi" };

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Detail inspeksi untuk pemantau dan admin: bukti lapangan (tidak dapat diubah dari mana
 * pun), jawaban, temuan, dan galeri foto bukti (SPEC §3.6 celah, §9 #1; ACCEPTANCE F5).
 * Foto disajikan /api/foto/{id} yang memeriksa sesi; URL blob tidak pernah ke klien.
 */
export default async function DetailInspeksiPage({ params }: PageProps<"/pemantau/inspeksi/[id]">) {
  await requireRole("admin", "pemantau");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [d, perButir] = await Promise.all([detailInspeksi(id), fotoPerButir(id)]);
  if (!d || d.ins.status !== "final") notFound();
  const i = d.ins;
  const radius = radiusEfektif({ radiusAset: d.aset.radiusM, lokasiTipe: d.aset.lokasiTipe });
  const tahun = i.inspectedAt ? tanggalIso(i.inspectedAt).slice(0, 4) : "";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/pemantau/inspeksi" className="text-muted-foreground underline-offset-4 hover:underline">
          ← Daftar inspeksi
        </Link>
      </p>
      <PageHeader
        title={`Inspeksi ${d.aset.kode}`}
        description={`${d.tipe} · ${labelLokasi(d.aset)}`}
        actions={
          <a
            href={`/laporan/kartu/${d.aset.id}?tahun=${tahun}`}
            target="_blank"
            rel="noopener"
            className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Kartu kontrol {tahun} (PDF)
          </a>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bukti lapangan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Baris label="Waktu resmi">{i.inspectedAt ? `${waktuDmyHm(i.inspectedAt)} WIB` : "-"}</Baris>
              <Baris label="Inspektur">
                {d.petugas} <span className="text-muted-foreground">({d.nipPetugas})</span>
              </Baris>
              <Baris label="Durasi pengisian">
                <span className={i.durasiDetik != null && i.durasiDetik < DURASI_WAJAR_DETIK ? "font-semibold text-danger" : undefined}>
                  {i.durasiDetik != null ? `${i.durasiDetik} detik` : "-"}
                </span>
                {i.durasiDetik != null && i.durasiDetik < DURASI_WAJAR_DETIK && <span className="ml-2 text-xs text-danger">tak wajar (&lt; {DURASI_WAJAR_DETIK} detik)</span>}
              </Baris>
              <Baris label="Pindai QR">{i.qrVerified ? `Terverifikasi${i.qrVerification === "offline_cache" ? " (luring)" : ""}` : "Tidak"}</Baris>
              <Baris label="Pengiriman">{i.offline ? "Lewat antrean luring" : "Daring"}</Baris>
              <Baris label="Gerbang lokasi">
                <LencanaGerbang status={i.gateStatus} />
              </Baris>
              <Baris label="Jarak ke titik aset">
                {i.jarakM != null ? `${i.jarakM} m` : "-"}
                {radius != null && <span className="text-muted-foreground"> (batas {radius} m)</span>}
              </Baris>
              <Baris label="Akurasi GPS">{i.gpsAccuracy != null ? `±${i.gpsAccuracy} m` : "-"}</Baris>
              <Baris label="Koordinat">{i.gpsLat != null && i.gpsLng != null ? `${i.gpsLat}, ${i.gpsLng}` : "-"}</Baris>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hasil dan tinjauan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Baris label="Kesimpulan">
                <LencanaKesimpulan k={i.kesimpulan} />
              </Baris>
              <Baris label="Catatan">{i.catatan || "-"}</Baris>
              <Baris label="Rekomendasi">{i.rekomendasi || "-"}</Baris>
              <Baris label="Tinjauan posisi">
                {i.ditinjauPada ? (
                  <>
                    Ditinjau {d.peninjau ?? "admin"} pada {waktuDmyHm(i.ditinjauPada)} WIB
                    {i.catatanReview && <span className="block text-muted-foreground">{i.catatanReview}</span>}
                  </>
                ) : perluTinjauan(i) ? (
                  <Lencana nada="waspada">Menunggu tinjauan Admin K3</Lencana>
                ) : (
                  "Tidak perlu"
                )}
              </Baris>
            </dl>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="judul-foto" className="mt-6">
        <h2 id="judul-foto" className="mb-3 text-lg font-semibold">
          Foto bukti ({d.foto.length})
        </h2>
        {d.foto.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada foto.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="galeri-foto">
            {d.foto.map((f, n) => (
              <li key={f.id} className="overflow-hidden rounded-lg border bg-card">
                <a href={`/api/foto/${f.id}`} target="_blank" rel="noopener" aria-label={`Buka foto ${n + 1} ukuran penuh`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto privat lewat rute bersesi, bukan aset statis */}
                  <img src={`/api/foto/${f.id}`} alt={`Foto bukti ${n + 1} inspeksi ${d.aset.kode}`} loading="lazy" className="aspect-[4/3] w-full bg-muted object-cover" />
                </a>
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {f.takenAtDevice ? `Diambil ${waktuDmyHm(f.takenAtDevice)}` : `Diunggah ${waktuDmyHm(f.uploadedAt)}`} WIB
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {perButir && (
        <section aria-labelledby="judul-foto-butir" className="mt-6">
          <h2 id="judul-foto-butir" className="mb-3 text-lg font-semibold">
            Foto per butir
          </h2>
          <FotoPerButir data={perButir} />
        </section>
      )}

      <section aria-labelledby="judul-jawaban" className="mt-6">
        <h2 id="judul-jawaban" className="mb-3 text-lg font-semibold">
          Butir pemeriksaan
        </h2>
        <Tabel label="Jawaban checklist">
          <thead>
            <tr>
              <th>Grup</th>
              <th>Butir</th>
              <th>Jawaban</th>
              <th>Simbol</th>
              <th>Temuan</th>
            </tr>
          </thead>
          <tbody>
            {d.jawaban.map((j) => {
              const sev = severityJawaban(j, j);
              return (
                <tr key={j.itemId}>
                  <td className="text-muted-foreground">{j.grup}</td>
                  <td>
                    {j.urut}. {j.label}
                    {j.dasarHukum && <span className="block text-xs text-muted-foreground">{j.dasarHukum}</span>}
                    {j.catatan && <span className="block text-xs">Catatan: {j.catatan}</span>}
                  </td>
                  <td>{labelNilai(j.answerType, j.nilai, j.nilaiAngka, j.satuan)}</td>
                  <td className="font-bold">{simbolJawaban(j, j)}</td>
                  <td>{sev ? <Lencana nada={NADA_TINGKAT[sev]}>{sev}</Lencana> : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </Tabel>
      </section>

      {d.temuan.length > 0 && (
        <section aria-labelledby="judul-temuan" className="mt-6">
          <h2 id="judul-temuan" className="mb-3 text-lg font-semibold">
            Temuan dari inspeksi ini
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {d.temuan.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <Lencana nada={NADA_TINGKAT[t.severity]}>{t.severity}</Lencana>
                <span className="flex-1">{t.item}</span>
                <span className="text-muted-foreground">
                  {LABEL_STATUS_TEMUAN[t.status]} · tenggat {t.targetSelesai ? tglDmy(t.targetSelesai) : "-"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
