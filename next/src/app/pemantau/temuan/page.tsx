import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { kapital, tanggalIso, tglDmy, tglSingkat, waktuDmyHm } from "@/features/laporan/format";
import { daftarTemuan, jejakTemuan, PER_HALAMAN, STATUS_FILTER, type FilterStatusTemuan } from "@/features/laporan/queries";
import { labelLokasi, lewatTenggat, umurHari } from "@/features/laporan/rakit";
import { Halaman, Kosong, Lencana, LABEL_STATUS_TEMUAN, NADA_STATUS_TEMUAN, NADA_TINGKAT, Tabel } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";
import { SEVERITIES, type Severity } from "@/lib/domain/constants";
import { TINDAKAN_BAKU } from "@/lib/domain/jawaban";

export const metadata: Metadata = { title: "Temuan" };

const LABEL_FILTER: Record<FilterStatusTemuan, string> = {
  belum_selesai: "Belum selesai",
  terbuka: "Terbuka",
  proses: "Proses",
  selesai: "Selesai",
  semua: "Semua",
};

const AKSI: Record<string, string> = { tenggat: "Tenggat", status: "Status", catatan: "Catatan", pic: "PIC" };

function ringkasJejak(ke: unknown): string {
  if (!ke || typeof ke !== "object") return "";
  return Object.entries(ke as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

/** Daftar temuan, hanya lihat (SPEC §5: "Temuan (lihat)"). Perubahan temuan milik Admin. */
export default async function TemuanPage({ searchParams }: PageProps<"/pemantau/temuan">) {
  await requireRole("admin", "pemantau");
  const q = await searchParams;
  const status = (STATUS_FILTER as readonly string[]).includes(String(q.status)) ? (q.status as FilterStatusTemuan) : "belum_selesai";
  const tingkat = (SEVERITIES as readonly string[]).includes(String(q.tingkat)) ? (q.tingkat as Severity) : null;
  const lewat = q.lewat === "1";
  const halaman = Math.max(1, Number(q.halaman) || 1);
  const now = new Date();
  const hariIni = tanggalIso(now);
  const { total, rows } = await daftarTemuan({ status, tingkat, lewat, halaman }, hariIni);
  const jejak = await jejakTemuan(rows.map((r) => r.id));

  const qs = (ubah: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const sekarang = { status, tingkat, lewat: lewat ? "1" : null, ...ubah };
    for (const [k, v] of Object.entries(sekarang)) if (v) p.set(k, v);
    return `/pemantau/temuan?${p}`;
  };

  return (
    <>
      <PageHeader title="Temuan" description="Temuan dari inspeksi beserta tenggat dan jejak tindak lanjutnya. Hanya lihat." />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {STATUS_FILTER.map((s) => (
          <Link
            key={s}
            href={qs({ status: s })}
            aria-current={s === status ? "page" : undefined}
            className={s === status ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-md border bg-card px-3 py-1.5 hover:bg-muted"}
          >
            {LABEL_FILTER[s]}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-border" aria-hidden />
        {[null, ...SEVERITIES].map((t) => (
          <Link
            key={t ?? "semua"}
            href={qs({ tingkat: t })}
            aria-current={t === tingkat ? "page" : undefined}
            className={t === tingkat ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-md border bg-card px-3 py-1.5 hover:bg-muted"}
          >
            {t ? kapital(t) : "Semua tingkat"}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-border" aria-hidden />
        <Link
          href={qs({ lewat: lewat ? null : "1" })}
          aria-pressed={lewat}
          className={lewat ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-md border bg-card px-3 py-1.5 hover:bg-muted"}
        >
          Lewat tenggat
        </Link>
      </div>

      {rows.length === 0 ? (
        <Kosong>Tidak ada temuan dengan saringan ini.</Kosong>
      ) : (
        <Tabel label="Daftar temuan">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Temuan</th>
              <th>Tingkat</th>
              <th>Tindakan yang diminta</th>
              <th>Tenggat</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const telat = r.status !== "selesai" && lewatTenggat(r, hariIni);
              const riwayat = jejak.get(r.id) ?? [];
              return (
                <tr key={r.id} className="align-top">
                  <td>
                    <span className="font-semibold">{r.kode}</span>
                    <span className="block text-xs text-muted-foreground">{labelLokasi(r)}</span>
                  </td>
                  <td>
                    {r.item}
                    <span className="block text-xs text-muted-foreground">
                      Ditemukan {tglSingkat(r.createdAt)} · {umurHari(r, now)} hari {r.selesaiPada ? "sampai selesai" : "berjalan"}
                      {r.inspectionId && (
                        <>
                          {" · "}
                          <Link href={`/pemantau/inspeksi/${r.inspectionId}`} className="underline-offset-4 hover:underline">
                            bukti inspeksi
                          </Link>
                        </>
                      )}
                    </span>
                    {riwayat.length > 0 && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Jejak tindak lanjut ({riwayat.length})</summary>
                        <ol className="mt-1 space-y-0.5">
                          {riwayat.map((e, n) => (
                            <li key={n}>
                              {waktuDmyHm(e.createdAt)} · {AKSI[e.aksi] ?? e.aksi}
                              {e.oleh ? ` oleh ${e.oleh}` : ""} · {ringkasJejak(e.ke)}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </td>
                  <td>
                    <Lencana nada={NADA_TINGKAT[r.severity]}>{kapital(r.severity)}</Lencana>
                  </td>
                  <td className="max-w-64">{r.tindakLanjut || TINDAKAN_BAKU[r.severity]}</td>
                  <td className={telat ? "font-semibold text-danger" : undefined}>
                    {r.targetSelesai ? tglDmy(r.targetSelesai) : "-"}
                    {telat && <span className="block text-xs">lewat</span>}
                  </td>
                  <td>
                    <Lencana nada={NADA_STATUS_TEMUAN[r.status]}>{LABEL_STATUS_TEMUAN[r.status]}</Lencana>
                    {r.pic && <span className="block text-xs text-muted-foreground">PIC {r.pic}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabel>
      )}
      <Halaman dasar={qs({})} halaman={halaman} total={total} per={PER_HALAMAN} />
    </>
  );
}
