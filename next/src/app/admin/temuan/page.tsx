import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kosong, Lencana, Paginasi, Pilihan, Tabel, halamanDari, qs } from "@/features/admin/components/ui";
import { LABEL_SEVERITY, LABEL_STATUS_TEMUAN, lewatTenggat } from "@/features/admin/lib/temuan";
import { PER_HALAMAN_TEMUAN, daftarTemuan, parseFilterTemuan } from "@/features/admin/server/temuan";
import { requireRole } from "@/lib/auth/guards";
import { ISSUE_STATUSES, SEVERITIES } from "@/lib/domain/constants";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatTanggal, hariIniJakarta } from "@/lib/format";

export const metadata: Metadata = { title: "Temuan" };

const nadaSeverity = (s: string) => (s === "berat" ? "danger" : s === "sedang" ? "warning" : "muted") as "danger" | "warning" | "muted";
const tgl = (d: string) => formatTanggal(d + "T00:00:00+07:00", { dateStyle: "medium" });

export default async function DaftarTemuan({ searchParams }: PageProps<"/admin/temuan">) {
  await requireRole("admin");
  const sp = await searchParams;
  const f = parseFilterTemuan(sp);
  const halaman = halamanDari(sp.hal);
  const { rows, total } = await daftarTemuan(f, halaman);
  const hariIni = hariIniJakarta();
  const param = { q: f.q, status: f.status === "belum_selesai" ? undefined : (f.status ?? "semua"), tingkat: f.severity, lewat: f.lewat };

  return (
    <>
      <PageHeader
        title="Temuan"
        description="Tindak lanjut temuan: terbuka → dalam proses → selesai, dengan jejak setiap perubahan."
        actions={
          <Button asChild variant="brand">
            <Link href="/admin/temuan/baru">
              <Plus aria-hidden /> Catat temuan
            </Link>
          </Button>
        }
      />
      <form method="get" className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Saring temuan">
        <label className="flex flex-col gap-1 text-xs font-medium lg:col-span-2">
          Cari
          <Input name="q" defaultValue={f.q} placeholder="Uraian temuan atau kode aset" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Status
          <Pilihan name="status" defaultValue={f.status === "belum_selesai" ? "" : (f.status ?? "semua")}>
            <option value="">Belum selesai</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_TEMUAN[s]}
              </option>
            ))}
            <option value="semua">Semua</option>
          </Pilihan>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Tingkat
          <Pilihan name="tingkat" defaultValue={f.severity ?? ""}>
            <option value="">Semua</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {LABEL_SEVERITY[s]}
              </option>
            ))}
          </Pilihan>
        </label>
        <div className="flex items-end justify-between gap-2">
          <label className="flex items-center gap-2 pb-1.5 text-sm">
            <input type="checkbox" name="lewat" value="1" defaultChecked={f.lewat} className="size-4 accent-primary" />
            Lewat tenggat
          </label>
          <Button type="submit">Terapkan</Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <Kosong>Tidak ada temuan yang cocok.</Kosong>
      ) : (
        <Tabel>
          <thead>
            <tr>
              <th>Aset</th>
              <th>Temuan</th>
              <th>Tingkat</th>
              <th>Status</th>
              <th>Tenggat</th>
              <th>Penanggung jawab</th>
              <th>Dicatat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap">
                  <span className="font-medium">{t.asetKode}</span>
                  <span className="block text-xs text-muted-foreground">
                    {labelLokasi({ lokasiTeks: t.asetLokasi, gedung: t.asetGedung, lantai: t.asetLantai })}
                  </span>
                </td>
                <td>
                  <Link href={`/admin/temuan/${t.id}`} className="font-medium hover:underline">
                    {t.item}
                  </Link>
                </td>
                <td>
                  <Lencana nada={nadaSeverity(t.severity)}>{LABEL_SEVERITY[t.severity]}</Lencana>
                </td>
                <td>
                  <Lencana nada={t.status === "selesai" ? "success" : t.status === "proses" ? "info" : "muted"}>{LABEL_STATUS_TEMUAN[t.status]}</Lencana>
                </td>
                <td className="whitespace-nowrap">
                  {t.targetSelesai ? (
                    lewatTenggat(t, hariIni) ? (
                      <Lencana nada="danger">Lewat · {tgl(t.targetSelesai)}</Lencana>
                    ) : (
                      tgl(t.targetSelesai)
                    )
                  ) : (
                    "-"
                  )}
                </td>
                <td>{t.pic ?? "-"}</td>
                <td className="whitespace-nowrap">{formatTanggal(t.createdAt, { dateStyle: "medium" })}</td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
      <Paginasi halaman={halaman} total={total} per={PER_HALAMAN_TEMUAN} hrefUntuk={(h) => `/admin/temuan${qs({ ...param, hal: h > 1 ? h : undefined })}`} />
    </>
  );
}
